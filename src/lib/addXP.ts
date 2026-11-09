import { GLOBAL_BSO_XP_MULTIPLIER } from '@/lib/bso/bsoConstants.js';
import { gorajanArcherOutfit, gorajanOccultOutfit, gorajanWarriorOutfit } from '@/lib/bso/collection-log/main.js';
import { isDoubleXpActive } from '@/lib/bso/doubleXp.js';
import { firstAgeXpBonusPercent, isWearingFullFirstAgeMaxSet } from '@/lib/bso/firstAge/shards.js';
import { resolveSkillOutfitXp } from '@/lib/bso/firstAge/skillOutfits.js';

import { bold } from '@oldschoolgg/discord';
import {
	Events,
	formatOrdinal,
	increaseNumByPercent,
	notEmpty,
	Time,
	toTitleCase,
	UserError
} from '@oldschoolgg/toolkit';
import { convertLVLtoXP, convertXPtoLVL, type Item, Items, toKMB } from 'oldschooljs';

import { type User, UserEventType } from '@/prisma/main.js';
import { MAX_LEVEL, MAX_LEVEL_XP, MAX_TOTAL_LEVEL, MAX_XP } from '@/lib/constants.js';
import { skillEmoji } from '@/lib/data/emojis.js';
import { getSimilarItems } from '@/lib/data/similarItems.js';
import { LAUNCH_XP_BONUS_SENTENCE, LAUNCH_XP_BOOST_PERCENT } from '@/lib/events/launch/constants.js';
import { maybeAnnounceLaunchFirst99, maybeAnnounceLaunchFirstMax } from '@/lib/events/launch/milestones.js';
import { isEventActive } from '@/lib/events/registry.js';
import type { AddXpParams } from '@/lib/minions/types.js';
import Skillcapes from '@/lib/skilling/skillcapes.js';
import { Skills } from '@/lib/skilling/skills/index.js';
import { type SkillNameType, SkillsArray } from '@/lib/skilling/types.js';
import { insertUserEvent } from '@/lib/util/userEvents.js';

const maxFilter = SkillsArray.map(s => `"skills.${s}" >= ${MAX_LEVEL_XP}`).join(' AND ');
const makeQuery = (ironman: boolean) => `SELECT count(id)::int
FROM users
WHERE ${maxFilter}
${ironman ? 'AND "minion.ironman" = true' : ''};`;

async function howManyMaxed() {
	const [normies, irons]: number[] = (
		await prisma.$transaction([
			prisma.$queryRawUnsafe<{ count: bigint }[]>(makeQuery(false)),
			prisma.$queryRawUnsafe<{ count: bigint }[]>(makeQuery(true))
		])
	)
		.map(i => i[0].count)
		.map(i => Number(i));

	return {
		normies,
		irons
	};
}

async function onMax(user: MUser) {
	const { normies, irons } = await howManyMaxed();

	const str = `🎉 ${
		user.usernameOrMention
	}'s minion just achieved level 120 in every skill, they are the **${formatOrdinal(normies)}** minion to be maxed${
		user.isIronman ? `, and the **${formatOrdinal(irons)}** ironman to max.` : '.'
	} 🎉`;

	globalClient.emit(Events.ServerNotification, str);
	const clientSettings = await ClientSettings.fetch({ maxing_message: true });
	globalClient.sendDm(user.id, clientSettings.maxing_message);
	await maybeAnnounceLaunchFirstMax(user, normies).catch(err => Logging.logError(err as Error));
}

interface StaticXPBoost {
	item: Item;
	boostPercent: number;
	skill: SkillNameType;
}
const staticXPBoosts = new Map<SkillNameType, StaticXPBoost[]>().set('firemaking', [
	{
		item: Items.getOrThrow('Flame gloves'),
		boostPercent: 2.5,
		skill: 'firemaking'
	},
	{
		item: Items.getOrThrow('Ring of fire'),
		boostPercent: 2.5,
		skill: 'firemaking'
	}
]);

const formatBonusPercent = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1));

function xpBonusSentences(input: {
	minimal: boolean | undefined;
	totalFirstAgeBonus: number;
	outfitBonusLine: string;
	totalStaticBoost: number;
	staticBoostsApplied: string[];
}): string {
	if (input.minimal) return '';
	let str = '';
	if (input.totalFirstAgeBonus > 0) {
		str += ` You received ${input.totalFirstAgeBonus}% bonus XP for First age outfit items.`;
	}
	if (input.outfitBonusLine) {
		str += input.outfitBonusLine;
	}
	if (input.totalStaticBoost > 0) {
		str += ` You received bonus XP from ${input.staticBoostsApplied.join(', ')}.`;
	}
	return str;
}

// Build list of all Master capes including combined capes.
const allMasterCapes = Skillcapes.map(i => i.masterCape)
	.map(msc => getSimilarItems(msc.id))
	.flat(Number.POSITIVE_INFINITY) as number[];

function getEquippedCapes(user: MUser): number[] {
	return Object.values(user.gear)
		.map(val => val.get('cape'))
		.filter(notEmpty)
		.map(i => i.item);
}

export async function addXP(user: MUser, params: AddXpParams): Promise<string> {
	if (!Number.isFinite(params.amount) || params.amount < 0) {
		throw new UserError('Invalid XP amount.');
	}
	const currentXP = Number(user.user[`skills_${params.skillName}`]);
	const currentLevel = user.skillLevel(params.skillName);
	const currentTotalLevel = user.totalLevel;
	const multiplier = params.multiplier !== false;
	let outfitBonusLine = '';
	if (!params.artificial) {
		const outfit = resolveSkillOutfitXp({
			source: user,
			skill: params.skillName,
			baseXp: params.amount,
			wearingFullMaxSet: isWearingFullFirstAgeMaxSet(user)
		});
		if (outfit) {
			params.amount += outfit.bonusXp;
			outfitBonusLine = ` ${outfit.line}`;
		}
	}
	if (multiplier) {
		params.amount *= GLOBAL_BSO_XP_MULTIPLIER;
	}
	const launchBoostApplied = multiplier && isEventActive('launch');
	if (launchBoostApplied) {
		params.amount = increaseNumByPercent(params.amount, LAUNCH_XP_BOOST_PERCENT);
	}
	const doubleXpApplied = multiplier && isDoubleXpActive(params.duration ?? 0);
	if (doubleXpApplied) {
		params.amount *= 2;
	}
	const launchSentence = `${launchBoostApplied ? ` ${LAUNCH_XP_BONUS_SENTENCE}` : ''}${
		doubleXpApplied ? ' You received 2x XP from Double XP.' : ''
	}`;

	// Look for Mastery skill cape:
	let matchingCapeID: number | undefined;
	let masterCape: number | undefined;
	const skillCape = Skillcapes.find(cape => params.skillName === cape.skill)?.masterCape;

	if (skillCape && (multiplier || params.masterCapeBoost)) {
		const equippedCapes = getEquippedCapes(user);

		matchingCapeID = equippedCapes.find(
			cape => cape === skillCape.id || getSimilarItems(skillCape.id).includes(cape)
		);
		masterCape = matchingCapeID ?? allMasterCapes.find(cape => equippedCapes.includes(cape));
		if (masterCape) {
			params.amount = increaseNumByPercent(params.amount, matchingCapeID ? 8 : 3);
		}
	}
	// Check if each gorajan set is equipped:
	const wildyOutfit = user.gear.wildy;
	const gorajanMeleeEquipped =
		user.gear.melee.hasEquipped(gorajanWarriorOutfit, true) || wildyOutfit.hasEquipped(gorajanWarriorOutfit, true);
	const gorajanRangeEquipped =
		user.gear.range.hasEquipped(gorajanArcherOutfit, true) || wildyOutfit.hasEquipped(gorajanArcherOutfit, true);
	const gorajanMageEquipped =
		user.gear.mage.hasEquipped(gorajanOccultOutfit, true) || wildyOutfit.hasEquipped(gorajanOccultOutfit, true);
	// Determine if boost should apply based on skill + equipped sets:
	let gorajanBoost = false;
	const gorajanMeleeBoost =
		multiplier && ['attack', 'strength', 'defence'].includes(params.skillName) && gorajanMeleeEquipped;
	const gorajanRangeBoost = multiplier && params.skillName === 'ranged' && gorajanRangeEquipped;
	const gorajanMageBoost = multiplier && params.skillName === 'magic' && gorajanMageEquipped;
	// 2x HP if all 3 gorajan sets are equipped:
	const gorajanHpBoost =
		multiplier &&
		params.skillName === 'hitpoints' &&
		gorajanMeleeEquipped &&
		gorajanRangeEquipped &&
		gorajanMageEquipped;
	if (gorajanMeleeBoost || gorajanRangeBoost || gorajanMageBoost || gorajanHpBoost) {
		params.amount *= 2;
		gorajanBoost = true;
	}

	let totalStaticBoost = 0;
	const staticBoostsApplied: string[] = [];
	// Score each gear setup on its own. user.hasEquipped() searches every setup, so a
	// cape removed from the set still counted while a copy sat on another setup.
	const totalFirstAgeBonus = firstAgeXpBonusPercent(user);
	if (totalFirstAgeBonus > 0) params.amount = increaseNumByPercent(params.amount, totalFirstAgeBonus);

	const boosts = staticXPBoosts.get(params.skillName);
	if (boosts && !params.artificial) {
		for (const booster of boosts) {
			if (user.hasEquippedOrInBank(booster.item.id)) {
				params.amount = increaseNumByPercent(params.amount, booster.boostPercent);
				totalStaticBoost += booster.boostPercent;
				staticBoostsApplied.push(`${booster.item.name} (+${formatBonusPercent(booster.boostPercent)}%)`);
			}
		}
	}

	params.amount = Math.floor(params.amount);
	const name = toTitleCase(params.skillName);

	const skill = Object.values(Skills).find(skill => skill.id === params.skillName)!;

	const newXP = Math.min(MAX_XP, currentXP + params.amount);
	const totalXPAdded = newXP - currentXP;
	const newLevel = convertXPtoLVL(Math.floor(newXP), MAX_LEVEL);

	// Pre-MAX_XP
	let preMax = -1;
	if (totalXPAdded > 0) {
		preMax = totalXPAdded;
		await prisma.xPGain.create({
			data: {
				user_id: BigInt(user.id),
				skill: params.skillName,
				xp: Math.floor(totalXPAdded),
				artificial: params.artificial ? true : null,
				source: params.source
			},
			select: { id: true }
		});
	}

	// Post-MAX_XP
	if (params.amount - totalXPAdded > 0) {
		await prisma.xPGain.create({
			data: {
				user_id: BigInt(user.id),
				skill: params.skillName,
				xp: Math.floor(params.amount - totalXPAdded),
				artificial: params.artificial ? true : null,
				post_max: true,
				source: params.source
			},
			select: { id: true }
		});
	}

	// If they reached a XP milestone, send a server notification.
	if (preMax !== -1) {
		for (const XPMilestone of [200_000_000, 1_000_000_000, 2_000_000_000, 3_000_000_000, 4_000_000_000]) {
			if (newXP < XPMilestone) break;

			if (currentXP < XPMilestone && newXP >= XPMilestone) {
				globalClient.emit(
					Events.ServerNotification,
					`${skill.emoji} **${user.badgedUsername}'s** minion, ${
						user.minionName
					}, just achieved ${newXP.toLocaleString()} XP in ${toTitleCase(params.skillName)}!`
				);
				break;
			}
		}
	}

	if (currentLevel < 99 && newLevel >= 99) {
		await maybeAnnounceLaunchFirst99(user, params.skillName).catch(err => Logging.logError(err as Error));
	}

	// // If they just reached 99, send a server notification.
	// if (currentLevel < 99 && newLevel >= 99) {
	// 	const skillNameCased = toTitleCase(params.skillName);
	// 	const [usersWith] = await prisma.$queryRawUnsafe<
	// 		{
	// 			count: string;
	// 		}[]
	// 	>(`SELECT COUNT(*) FROM users WHERE "skills.${params.skillName}" >= ${LEVEL_99_XP};`);

	// 	let str = `${skill.emoji} **${user.usernameOrMention}'s** minion, ${
	// 		user.minionName
	// 	}, just achieved level 99 in ${skillNameCased}! They are the ${formatOrdinal(
	// 		parseInt(usersWith.count) + 1
	// 	)} to get 99 ${skillNameCased}.`;

	// 	if (user.isIronman) {
	// 		const [ironmenWith] = await prisma.$queryRawUnsafe<
	// 			{
	// 				count: string;
	// 			}[]
	// 		>(
	// 			`SELECT COUNT(*) FROM users WHERE "minion.ironman" = true AND "skills.${params.skillName}" >= ${LEVEL_99_XP};`
	// 		);
	// 		str += ` They are the ${formatOrdinal(parseInt(ironmenWith.count) + 1)} Ironman to get 99.`;
	// 	}
	// 	globalClient.emit(Events.ServerNotification, str);
	// }

	if (currentXP < MAX_XP && newXP >= MAX_XP) {
		await insertUserEvent({ userID: user.id, type: UserEventType.MaxXP, skill: skill.id });
	}

	// Announcements with nthUser
	for (const { type, value } of [
		{ type: 'lvl', value: 120 },
		{ type: 'xp', value: 500_000_000 },
		{ type: 'xp', value: 5_000_000_000 }
	]) {
		// Ignore check
		if (type === 'lvl') {
			if (newLevel < value || currentLevel >= value || newLevel < value) continue;
		} else if (newXP < value || currentXP >= value || newXP < value) continue;
		const skillNameCased = toTitleCase(params.skillName);
		let resultStr = '';
		let queryValue = 0;
		// Prepare the message to be sent
		if (type === 'lvl') {
			await insertUserEvent({ userID: user.id, type: UserEventType.MaxLevel, skill: skill.id });
			queryValue = convertLVLtoXP(value);
			resultStr += `${skill.emoji} **${user.usernameOrMention}'s** minion, ${
				user.minionName
			}, just achieved level ${value} in ${skillNameCased}! They are the {nthUser} to get level ${value} in ${skillNameCased}.${
				!user.isIronman ? '' : ` They are the {nthIron} Ironman to get level ${value} in ${skillNameCased}`
			}`;
		} else {
			queryValue = value;
			resultStr += `${skill.emoji} **${user.usernameOrMention}'s** minion, ${
				user.minionName
			}, just achieved ${toKMB(value)} XP in ${skillNameCased}! They are the {nthUser} to get ${toKMB(
				value
			)} in ${skillNameCased}.${
				!user.isIronman ? '' : ` They are the {nthIron} Ironman to get ${toKMB(value)} XP in ${skillNameCased}`
			}`;
		}
		// Query nthUser and nthIronman
		const [nthUser] = await prisma.$queryRawUnsafe<
			{
				count: string;
			}[]
		>(`SELECT COUNT(*)::int FROM users WHERE "skills.${params.skillName}" >= ${queryValue};`);
		resultStr = resultStr.replace('{nthUser}', formatOrdinal(Number(nthUser.count) + 1));
		if (user.isIronman) {
			const [nthIron] = await prisma.$queryRawUnsafe<
				{
					count: string;
				}[]
			>(
				`SELECT COUNT(*)::int FROM users WHERE "minion.ironman" = true AND "skills.${params.skillName}" >= ${queryValue};`
			);
			resultStr = resultStr.replace('{nthIron}', formatOrdinal(Number(nthIron.count) + 1));
		}
		globalClient.emit(Events.ServerNotification, resultStr);
	}

	const bonusSentences = xpBonusSentences({
		minimal: params.minimal,
		totalFirstAgeBonus,
		outfitBonusLine,
		totalStaticBoost,
		staticBoostsApplied
	});

	if (currentXP >= MAX_XP) {
		let xpStr = '';
		if (params.duration && !params.minimal) {
			xpStr += `You received no XP because you have ${toKMB(MAX_XP)} ${name}XP already`;
			xpStr += ` Tracked ${params.amount.toLocaleString()}${skill.emoji}XP.`;
			let rawXPHr = (params.amount / (params.duration / Time.Minute)) * 60;
			rawXPHr = Math.floor(rawXPHr / 1000) * 1000;
			xpStr += ` (${toKMB(rawXPHr)}/Hr)`;
			xpStr += bonusSentences;
			xpStr += launchSentence;
		} else {
			xpStr += `🚫 ${params.amount.toLocaleString()} ${params.skillName} XP`;
			if (!params.minimal) xpStr += bonusSentences;
			xpStr += launchSentence;
		}
		return xpStr;
	}

	await prisma.$queryRawUnsafe(
		`UPDATE users SET "skills.${params.skillName}" = ${Math.floor(newXP)} WHERE id = '${user.id}';`
	);
	(user.user as User)[`skills_${params.skillName}`] = BigInt(Math.floor(newXP));
	user.updateProperties();

	if (currentXP < MAX_XP && newXP === MAX_XP && Object.values(user.skillsAsXP).every(xp => xp === MAX_XP)) {
		globalClient.emit(
			Events.ServerNotification,
			bold(
				`🎉 ${skill.emoji}** ${user.badgedUsername}'s** minion, ${user.minionName}, just achieved the maximum possible total XP!`
			)
		);
		await insertUserEvent({ userID: user.id, type: UserEventType.MaxTotalXP });
	}

	let str = '';
	if (preMax !== -1) {
		str = params.minimal
			? `+${Math.ceil(params.amount).toLocaleString()} ${skillEmoji[params.skillName]}`
			: `You received ${Math.ceil(params.amount).toLocaleString()} ${skillEmoji[params.skillName]} XP.`;
		if (masterCape && !params.minimal) {
			str += ` You received ${matchingCapeID ? '8' : '3'}% bonus XP for having a ${Items.itemNameFromId(masterCape)}.`;
		}
		if (gorajanBoost && !params.minimal) {
			str += ' (2x boost from Gorajan armor)';
		}
		str += bonusSentences;
		str += launchSentence;

		if (params.duration) {
			let rawXPHr = (params.amount / (params.duration / Time.Minute)) * 60;
			rawXPHr = Math.floor(rawXPHr / 1000) * 1000;
			str += ` (${toKMB(rawXPHr)}/Hr)`;
		}

		if (currentTotalLevel < MAX_TOTAL_LEVEL && user.totalLevel >= MAX_TOTAL_LEVEL) {
			str += '\n\n**Congratulations, your minion has reached the maximum total level!**\n\n';
			await onMax(user);
		} else if (currentLevel !== newLevel) {
			str += params.minimal
				? `(Levelled up to ${newLevel})`
				: `\n**Congratulations! Your ${name} level is now ${newLevel}** 🎉`;
		}
	}
	return str;
}
