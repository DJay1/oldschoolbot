import {
	canAffordInventionBoost,
	InventionID,
	inventionBoosts,
	inventionItemBoost
} from '@/lib/bso/skills/invention/inventions.js';

import { bold, EmbedBuilder } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank } from 'oldschooljs';
import { clamp } from 'remeda';

import {
	calculateTfaGearPercents,
	checkTfaUser,
	createTfaRaids,
	minTfaStats,
	TFA_MAX_QUANTITY,
	TFA_MIN_GEAR_PERCENT,
	TFA_PITY_CAP,
	TFA_PITY_PER_WIPE,
	TFA_SUPPLY_KC_STEP,
	type TfaTeamMember,
	tfaBossByID,
	tfaChargesNeeded,
	tfaHelpBoostsText,
	tfaItemBoosts,
	tfaPityPercent,
	tfaRaidWipeChance,
	tfaSingleRaidDuration,
	tfaSuppliesForKc,
	tfaTeamMemberFromUser,
	tfaUserSpeedReduction
} from '@/lib/bsc/tfa/tfa.js';
import { tfaFragmentsUsed } from '@/lib/bsc/tfa/tfaFragments.js';
import { tfaUniqueItems } from '@/lib/bsc/tfa/tfaItems.js';
import { tfaTeamUniqueOdds } from '@/lib/bsc/tfa/tfaLoot.js';
import {
	TFA_ROOM_BOOST_CAP,
	tfaRoomBoostsFor,
	tfaRoomBoostsText,
	tfaRoomItemsHelpLines,
	tfaRoomPercent
} from '@/lib/bsc/tfa/tfaRooms.js';
import type { TFAOptions } from '@/lib/bsc/tfa/tfaTypes.js';
import { BitField } from '@/lib/constants.js';
import { degradeableItems, degradeItem } from '@/lib/degradeableItems.js';
import { trackLoot } from '@/lib/lootTrack.js';
import type { MakePartyOptions } from '@/lib/types/index.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const RAID_NAME = 'The Fractured Archive';

function tfaPityLine(team: TfaTeamMember[]) {
	const best = Math.max(...team.map(m => tfaPityPercent(m.wipeStreak)));
	if (best <= 0) return '';
	return team.length === 1
		? ` Wipe pity: ${best}% lower death chance after ${team[0].wipeStreak} wiped raid${team[0].wipeStreak === 1 ? '' : 's'} in a row.`
		: '';
}

export async function tfaStartCommand(
	interaction: MInteraction | null | undefined,
	user: MUser,
	solo: boolean,
	channelId: string,
	teamSize: number | undefined,
	quantityInput: number | undefined
): CommandResponse {
	if (await user.minionIsBusy()) return `${user.usernameOrMention} minion is busy.`;

	const initialCheck = checkTfaUser(user, 1, await user.fetchMinigameScore('fractured_archive'));
	if (initialCheck) return initialCheck;

	const maxSize = mahojiParseNumber({ input: teamSize, min: 2, max: 8 }) ?? 8;

	let users: MUser[];
	if (solo || !interaction) {
		users = [user];
	} else {
		const partyOptions: MakePartyOptions = {
			interaction,
			leader: user,
			minSize: 1,
			maxSize,
			ironmanAllowed: true,
			message: `${user.usernameOrMention} is hosting a ${RAID_NAME} mass! Use the buttons below to join/leave.`,
			customDenier: async checkUser => {
				const res = checkTfaUser(checkUser, 1, await checkUser.fetchMinigameScore('fractured_archive'));
				if (res) return [true, res];
				return [false];
			}
		};
		users = (await globalClient.makeParty(partyOptions)).slice(0, maxSize);
	}

	if (users.length < 1 || users.length > 8) return 'Your team must be 1-8 players.';
	if (new Set(users.map(u => u.id)).size !== users.length) return 'A player is in your team twice.';
	if (await ActivityManager.anyMinionIsBusy(users.map(u => u.id))) {
		return 'One of the users in your mass has a busy minion.';
	}

	// Fresh data for everyone right before the checks and supply removal.
	users = await Promise.all(users.map(u => mUserFetch(u.id)));

	const team = await Promise.all(
		users.map(async u =>
			tfaTeamMemberFromUser(
				u,
				await u.fetchMinigameScore('fractured_archive'),
				(await u.fetchStats()).tfa_wipe_streak ?? 0
			)
		)
	);

	// Chincannon (like CoX): one team member's equipped Chincannon makes the whole raid faster, but destroys all loot.
	const chinCannonUser = users.find(u => u.hasEquipped('Chincannon')) ?? null;
	const chincannonPercent = chinCannonUser ? inventionBoosts.chincannon.tfaPercentReduction : 0;

	const singleRaid = tfaSingleRaidDuration(team, chincannonPercent);
	const maxTripLength = Math.min(...(await Promise.all(users.map(u => u.calcMaxTripLength('FracturedArchive')))));
	const maxQuantity = clamp(Math.floor(maxTripLength / singleRaid), { min: 1, max: TFA_MAX_QUANTITY });
	const quantity = clamp(quantityInput ?? maxQuantity, { min: 1, max: maxQuantity });

	for (let i = 0; i < users.length; i++) {
		const u = users[i];
		const res = checkTfaUser(u, quantity, team[i].kc);
		if (res) {
			return {
				content: `Your mass failed to start because of this reason: ${res}`,
				allowedMentions: { users: users.map(i => i.id) }
			};
		}
	}

	const wipeChance = tfaRaidWipeChance(team);
	const { raids, realDuration, fakeDuration } = createTfaRaids({ team, quantity, chincannonPercent });

	let chincannonStr = '';
	if (chinCannonUser) {
		if (!canAffordInventionBoost(chinCannonUser, InventionID.ChinCannon, realDuration).canAfford) {
			return `${chinCannonUser.usernameOrMention} doesn't have enough materials to use the Chincannon for this trip.`;
		}
		// Charged before any supplies are removed, so a failed charge costs nothing.
		const res = await inventionItemBoost({
			user: chinCannonUser,
			inventionID: InventionID.ChinCannon,
			duration: realDuration
		});
		if (!res.success) {
			return `${chinCannonUser.usernameOrMention} couldn't use the Chincannon for this trip.`;
		}
		chincannonStr = `\n${chinCannonUser.usernameOrMention}'s Chincannon: ${chincannonPercent}% faster (${res.messages}). **All loot from this trip will be destroyed.**`;
	}

	const rolledBosses = [...new Set(raids.flatMap(r => r.b))].sort((a, b) => a - b);
	const bossName = (id: number) => tfaBossByID(id).name;
	const totalCost = new Bank();
	const costs: { id: string; cost: Bank }[] = [];
	let details = '';
	const usedSupplies: Bank[] = [];
	for (let i = 0; i < users.length; i++) {
		const u = users[i];
		// Supplies scale with this player's own KC (same KC the start check used).
		const supplies = tfaSuppliesForKc(team[i].kc).multiply(quantity);
		await u.transactItems({ itemsToRemove: supplies.clone() });
		await u.statsBankUpdate('tfa_cost', supplies);
		for (const charge of tfaChargesNeeded(u, quantity)) {
			const degItem = degradeableItems.find(d => d.item.id === charge.itemID)!;
			await degradeItem({ item: degItem.item, chargesToDegrade: charge.charges, user: u });
		}
		totalCost.add(supplies);
		costs.push({ id: u.id, cost: supplies.clone() });
		const member = team[i];
		const boostNames = member.boosts.map(b => b.name);
		details += `**- ${u.usernameOrMention}** Gear: ${member.gear.total.toFixed(1)}% | Speed: ${tfaUserSpeedReduction(member).toFixed(1)}%${
			boostNames.length > 0 ? ` | Boosts: ${boostNames.join(', ')}` : ''
		}${member.deathReduction > 0 ? ' | Rondache' : ''}${tfaPityPercent(member.wipeStreak) > 0 ? ` | Wipe pity ${tfaPityPercent(member.wipeStreak)}%` : ''}\n`;
		// Item names for small teams; big masses get per-room totals so the message stays under Discord's limit.
		const rooms =
			users.length <= 2
				? tfaRoomBoostsText(member.roomBoosts, rolledBosses, bossName)
				: rolledBosses
						.filter(id => tfaRoomPercent(member.roomBoosts, id) > 0)
						.map(id => `${bossName(id)} ${tfaRoomPercent(member.roomBoosts, id)}%`);
		if (rooms.length > 0) details += `  Rooms: ${rooms.join(' | ')}\n`;
		details += `  Used: ${supplies}\n`;
		usedSupplies.push(supplies);
	}

	await ClientSettings.updateBankSetting('tfa_cost', totalCost);
	await trackLoot({
		totalCost,
		id: 'fractured_archive',
		type: 'Minigame',
		changeType: 'cost',
		users: costs.map(c => ({ id: c.id, cost: c.cost, duration: realDuration }))
	});

	await ActivityManager.startTrip<TFAOptions>({
		userID: user.id,
		channelId,
		duration: realDuration,
		type: 'FracturedArchive',
		leader: user.id,
		users: users.map(u => u.id),
		fakeDuration,
		quantity,
		raids,
		repeatMaxSize: solo || !interaction ? undefined : maxSize,
		cc: chinCannonUser?.id
	});

	return `${user.usernameOrMention}'s party (${users.map(u => u.usernameOrMention).join(', ')}) is now off to do ${
		quantity === 1 ? 'a' : `${quantity}x`
	} ${RAID_NAME} raid${quantity === 1 ? '' : 's'} - the total trip will take ${formatDuration(fakeDuration)}. Team unique chance: 1 in ${tfaTeamUniqueOdds(users.length)} per raid. Wipe chance: ${wipeChance.toFixed(1)}% per raid.${tfaPityLine(team)}

${
	// Same supplies for everyone: one line at the end instead of a line per player (keeps big masses short).
	usedSupplies.every(s => s.equals(usedSupplies[0]))
		? `${details.replaceAll(`  Used: ${usedSupplies[0]}\n`, '')}Each player used: ${usedSupplies[0]}`
		: details
}${chincannonStr}`;
}

export async function tfaHelpCommand(user: MUser): Promise<string> {
	const gear = calculateTfaGearPercents(user);
	const kc = await user.fetchMinigameScore('fractured_archive');
	const stats = await user.fetchStats();
	const uniques = tfaUniqueItems.reduce((acc, id) => acc + user.cl.amount(id), 0);
	const { boosts, deathReduction } = tfaItemBoosts(user);
	const check = checkTfaUser(user, 1, kc);
	const minutes = stats.tfa_total_minutes ?? 0;
	const streak = stats.tfa_wipe_streak ?? 0;
	const soloWipe = tfaRaidWipeChance([tfaTeamMemberFromUser(user, kc, streak)]);
	const roomLines = tfaRoomBoostsText(
		tfaRoomBoostsFor(user.gear, id => user.hasEquippedOrInBank(id)),
		[1, 2, 3, 4, 5, 6, 7, 8],
		id => tfaBossByID(id).name
	);

	return `**${RAID_NAME}**

**KC:** ${kc}
**Attempts:** ${stats.tfa_attempts ?? 0}
**Uniques:** ${uniques}${uniques > 0 ? ` (one every ${Math.floor(kc / uniques)} raids, one every ${formatDuration((minutes * Time.Minute) / uniques)})` : ''}

**Requirements**
- While Guthix Sleeps
- ${formatSkillRequirements(minTfaStats)}
- At least ${TFA_MIN_GEAR_PERCENT}% in your melee, range and mage setups (yours: melee ${gear.melee.toFixed(1)}%, range ${gear.range.toFixed(1)}%, mage ${gear.mage.toFixed(1)}%)
- Supplies per raid at your KC: ${tfaSuppliesForKc(kc)} (one less Saradomin brew(4) every ${TFA_SUPPLY_KC_STEP} KC, down to 4 at 200 KC)

**How it works**
Archive Guardian, then one of Ezekiel or Bork and the Smorks, one of Moia or Dreadnoth the Jellied, one of The Dagon'hai or Xarth, then Ocellus. Bosses are picked at random each raid.
Team unique chance is 1/16 solo or duo, down to 1/7.5 with 8. The unique goes to one player weighted by contribution points (700 per raid, split by damage; each death costs 10% of your expected share). Everyone else gets 3 rolls on the normal loot. If the whole team dies at a boss, the raid fails and the supplies are lost. Each raid wiped in a row lowers your death chance by ${TFA_PITY_PER_WIPE}% (up to ${TFA_PITY_CAP}%) until you complete a raid.
**Your solo wipe chance:** ${soloWipe.toFixed(1)}% per raid${streak > 0 ? ` (${streak} wiped in a row, ${tfaPityPercent(streak)}% wipe pity)` : ''}

**Boosts**
${tfaHelpBoostsText()
	.map(b => `- ${b}`)
	.join('\n')}
- Each used elemental fragment: 0.5% faster (you've used ${tfaFragmentsUsed(user)}/4)
- Room items: some items speed up a boss's room when it's rolled. See \`/raid tfa rooms\` (you have ${roomLines.length} room${roomLines.length === 1 ? '' : 's'} boosted).

**Your boosts:** ${boosts.length > 0 ? boosts.map(b => `${b.name} (${b.percent}%)`).join(', ') : 'None'}${deathReduction > 0 ? ', Rondache' : ''}
**Zeal:** ${user.bitfield.includes(BitField.HasZeal) ? 'Unlocked' : 'Locked'}

${check ? `\u26A0\uFE0F ${bold('Not ready:')} ${check}` : '\u2705 You are ready to start a raid.'}`;
}

export async function tfaStatsCommand(user: MUser): Promise<string> {
	const kc = await user.fetchMinigameScore('fractured_archive');
	const stats = await user.fetchStats();
	const loot = new Bank(stats.tfa_loot as ItemBank);
	const cost = new Bank(stats.tfa_cost as ItemBank);
	return `**${RAID_NAME} stats**
**KC:** ${kc}
**Attempts:** ${stats.tfa_attempts ?? 0}
**Time raided:** ${formatDuration((stats.tfa_total_minutes ?? 0) * Time.Minute)}
**Loot value:** ${loot.value().toLocaleString()} GP
**Supplies used:** ${cost.length > 0 ? cost.toString() : 'None'}`;
}

export async function tfaRoomsCommand(user: MUser): CommandResponse {
	const bossName = (id: number) => tfaBossByID(id).name;
	const mine = tfaRoomBoostsText(
		tfaRoomBoostsFor(user.gear, id => user.hasEquippedOrInBank(id)),
		[1, 2, 3, 4, 5, 6, 7, 8],
		bossName
	);
	// The full list is longer than a 2,000 character message, so it goes in an embed (4,096 limit).
	const description = `These only speed up that boss's room, and only in raids where that boss is rolled. Each group counts its best item, up to ${TFA_ROOM_BOOST_CAP}% per room. "bank" items count from your bank or any setup; "Full" sets need all 5 pieces worn.
${tfaRoomItemsHelpLines(bossName)
	.map(l => `- ${l}`)
	.join('\n')}

**Yours:** ${mine.length > 0 ? mine.join(' | ') : 'None'}`;
	return {
		embeds: [new EmbedBuilder().setTitle(`${RAID_NAME} room items`).setDescription(description.slice(0, 4096))]
	};
}
