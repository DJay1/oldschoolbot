import { Emoji, Events, formatOrdinal, Time } from '@oldschoolgg/toolkit';
import { MathRNG, type RNGProvider } from 'node-rng';
import { Bank } from 'oldschooljs';

import { tfaBossByID } from '@/lib/bsc/tfa/tfa.js';
import { TfaItem, tfaAnnouncedItems, tfaCL, tfaFragmentIDs, tfaUniqueItems } from '@/lib/bsc/tfa/tfaItems.js';
import {
	pickTfaUniqueRecipient,
	rollTfaStandardLoot,
	rollTfaTertiaries,
	rollTfaUniqueItem,
	TFA_ORION_ODDS,
	tfaTeamUniqueOdds
} from '@/lib/bsc/tfa/tfaLoot.js';
import type { TFAOptions } from '@/lib/bsc/tfa/tfaTypes.js';
import { userHasFlappy } from '@/lib/bso/skills/invention/inventions.js';
import { trackLoot } from '@/lib/lootTrack.js';
import { resolveAttackStyles } from '@/lib/minions/functions/resolveAttackStyles.js';
import { TeamLoot } from '@/lib/simulation/TeamLoot.js';
import { XPCounter } from '@/lib/structures/XPCounter.js';
import { launchPetRate } from '@/lib/util.js';

const RAID_NAME = 'The Fractured Archive';

/** XP per boss killed. A full raid is 5 bosses. */
const XP_PER_BOSS = {
	hitpoints: 1800,
	ranged: 1400,
	magic: 1400,
	melee: 3600
};

/** Builds the XP for one user. Pure so it can be tested. */
export function tfaXPForBosses(bossesKilled: number, meleeStyles: ('attack' | 'strength' | 'defence')[]): XPCounter {
	const counter = new XPCounter();
	if (bossesKilled <= 0) return counter;
	counter.add('hitpoints', XP_PER_BOSS.hitpoints * bossesKilled);
	counter.add('ranged', XP_PER_BOSS.ranged * bossesKilled);
	counter.add('magic', XP_PER_BOSS.magic * bossesKilled);
	const styles = meleeStyles.length > 0 ? meleeStyles : (['attack', 'strength', 'defence'] as const);
	for (const style of styles) {
		counter.add(style, (XP_PER_BOSS.melee * bossesKilled) / styles.length);
	}
	return counter;
}

/** Bosses the team killed in a raid (all 5 if completed, otherwise those before the wipe). */
export function tfaBossesKilled(raid: TFAOptions['raids'][number]): number {
	if (raid.w === null) return raid.b.length;
	return raid.b.indexOf(raid.w);
}

/**
 * Rolls all the loot for a finished trip. Pure apart from RNG so it can be tested.
 * - One team unique roll per completed raid, given out by contribution.
 * - Everyone who didn't get the unique gets 3 standard rolls.
 * - Tertiaries for everyone on every completed raid.
 * - Flappy / RoboFlappy users get their raid loot (unique or standard rolls) doubled, like CoX. Tertiaries (folio,
 *   fragments, Orion) are never doubled, the same way CoX doesn't double its separate pet rolls.
 */
export function rollTfaTripLoot({
	userIDs,
	raids,
	ownsFolio,
	fragmentsObtained,
	petOdds = TFA_ORION_ODDS,
	flappy = {},
	rng = MathRNG
}: {
	userIDs: string[];
	raids: TFAOptions['raids'];
	ownsFolio: Record<string, boolean>;
	fragmentsObtained: Record<string, number[]>;
	petOdds?: number;
	flappy?: Record<string, boolean>;
	rng?: RNGProvider;
}) {
	const loot = new TeamLoot(tfaCL);
	const folio = { ...ownsFolio };
	const fragments: Record<string, number[]> = {};
	for (const id of userIDs) fragments[id] = [...(fragmentsObtained[id] ?? [])];
	const uniqueOdds = tfaTeamUniqueOdds(userIDs.length);
	const purples: { userID: string; item: number }[] = [];

	for (const raid of raids) {
		if (raid.w !== null) continue;
		const contributions = userIDs.map((id, i) => ({ id, points: raid.u[i]?.p ?? 0 }));
		const recipient = rng.roll(uniqueOdds) ? pickTfaUniqueRecipient(contributions, rng) : null;
		for (const id of userIDs) {
			if (recipient === id) {
				const item = rollTfaUniqueItem(rng);
				loot.add(id, item, flappy[id] ? 2 : 1);
				purples.push({ userID: id, item });
			} else {
				const standard = rollTfaStandardLoot(rng);
				loot.add(id, flappy[id] ? standard.multiply(2) : standard);
			}
			const tertiary = rollTfaTertiaries({
				ownsFolio: folio[id] ?? false,
				fragmentsObtained: fragments[id],
				petOdds,
				rng
			});
			if (tertiary.has(TfaItem.ARCHIVISTS_FOLIO)) folio[id] = true;
			for (const frag of tfaFragmentIDs) if (tertiary.has(frag)) fragments[id].push(frag);
			loot.add(id, tertiary);
		}
	}
	return { loot, purples };
}

export const tfaTask: MinionTask = {
	type: 'FracturedArchive',
	async run(data: TFAOptions, { handleTripFinish }) {
		const { channelId, duration, leader, quantity, users, raids } = data;
		const allUsers = await Promise.all(users.map(id => mUserFetch(id)));
		const isSolo = allUsers.length === 1;
		const previousCLs = allUsers.map(u => u.cl.clone());
		const minutes = Math.floor(duration / Time.Minute);

		const completed = raids.filter(r => r.w === null).length;

		await Promise.all(
			allUsers.map(u =>
				u.statsUpdate({
					tfa_attempts: { increment: quantity },
					tfa_total_minutes: { increment: minutes }
				})
			)
		);

		// Loot (only completed raids give loot)
		const ownsFolio: Record<string, boolean> = {};
		const fragmentsObtained: Record<string, number[]> = {};
		for (const u of allUsers) {
			ownsFolio[u.id] = u.allItemsOwned.has(TfaItem.ARCHIVISTS_FOLIO);
			fragmentsObtained[u.id] = tfaFragmentIDs.filter(id => u.cl.has(id));
		}
		// Flappy / RoboFlappy: checked once per user per trip (RoboFlappy charges its materials once), only if there's loot.
		const flappy: Record<string, boolean> = {};
		const flappyMsgs: Record<string, string> = {};
		if (completed > 0) {
			for (const u of allUsers) {
				const res = await userHasFlappy({ user: u, duration });
				if (res.shouldGiveBoost) {
					flappy[u.id] = true;
					flappyMsgs[u.id] = res.userMsg;
				}
			}
		}
		const { loot: totalLoot } = rollTfaTripLoot({
			userIDs: users,
			raids,
			ownsFolio,
			fragmentsObtained,
			petOdds: launchPetRate(TFA_ORION_ODDS),
			flappy
		});

		const newScores: Record<string, number> = {};
		if (completed > 0) {
			for (const u of allUsers) {
				const res = await u.incrementMinigameScore('fractured_archive', completed);
				newScores[u.id] = res.newScore;
			}
		}

		const resultMessage = new MessageBuilder().setContent(
			isSolo
				? `${allUsers[0]}, your minion finished ${quantity === 1 ? 'a' : `${quantity}x`} ${RAID_NAME} raid${
						quantity > 1 ? 's' : ''
					}! ${completed > 0 ? `Your KC is now ${newScores[allUsers[0].id]}.` : ''}\n`
				: `<@${leader}> Your ${RAID_NAME} raid${quantity > 1 ? 's have' : ' has'} finished.\n`
		);

		const raidLines: string[] = [];
		for (let i = 0; i < raids.length; i++) {
			const raid = raids[i];
			const route = raid.b.map(id => tfaBossByID(id).name).join(' > ');
			raidLines.push(
				raid.w === null
					? `Raid ${i + 1}: ${route}`
					: `Raid ${i + 1}: ${route} - your team wiped at ${tfaBossByID(raid.w).name}, no loot.`
			);
		}

		const shouldShowImage =
			completed > 0 && allUsers.length <= 3 && totalLoot.entries().every(i => i[1].length <= 6);

		for (let idx = 0; idx < allUsers.length; idx++) {
			const user = allUsers[idx];
			const userLoot = totalLoot.get(user.id);
			const deaths = raids.reduce((acc, r) => acc + (r.u[idx]?.d.length ?? 0), 0);
			const points = raids.filter(r => r.w === null).reduce((acc, r) => acc + (r.u[idx]?.p ?? 0), 0);

			let itemsAdded = new Bank();
			if (userLoot.length > 0) {
				const res = await user.transactItems({ itemsToAdd: userLoot, collectionLog: true });
				itemsAdded = res.itemsAdded;
				await user.statsBankUpdate('tfa_loot', userLoot);
			}

			if (itemsAdded.items().some(([item]) => tfaAnnouncedItems.includes(item.id))) {
				const toAnnounce = itemsAdded.filter(item => tfaAnnouncedItems.includes(item.id));
				globalClient.emit(
					Events.ServerNotification,
					`${user.notificationName} just received **${toAnnounce}** on their ${formatOrdinal(
						newScores[user.id] ?? 0
					)} ${RAID_NAME} raid.`
				);
			}

			// XP: once per user, for every boss killed across the trip, using the trip duration.
			const bossesKilled = raids.reduce((acc, r) => acc + tfaBossesKilled(r), 0);
			let styles = resolveAttackStyles({ attackStyles: user.getAttackStyles() }) as string[];
			if (styles.some(s => s === 'magic' || s === 'ranged')) styles = ['attack', 'strength', 'defence'];
			const xpCounter = tfaXPForBosses(bossesKilled, styles as ('attack' | 'strength' | 'defence')[]);
			const xpStr =
				xpCounter.length > 0
					? await user.addXPCounter({ xpCounter, source: 'FracturedArchive', minimal: true, duration })
					: '';

			const isPurple = itemsAdded.items().some(([item]) => tfaUniqueItems.includes(item.id as never));
			const lootStr = isPurple ? `${Emoji.Purple} ||${itemsAdded}||` : itemsAdded.toString();
			const deathStr = deaths === 0 ? '' : `${new Array(Math.min(deaths, 10)).fill(Emoji.Skull).join('')} `;
			resultMessage.addContent(
				`\n${deathStr}**${user}** (${points} points)${
					shouldShowImage || itemsAdded.length === 0 ? '' : ` received: ${lootStr}`
				} ${xpStr}`
			);
			if (flappyMsgs[user.id]) resultMessage.addContent(isSolo ? `\n${flappyMsgs[user.id]}` : Emoji.Flappy);
		}

		resultMessage.addContent(`\n\n${raidLines.join('\n')}`);
		if (completed > 0) {
			resultMessage.addContent(`\nTeam unique chance was 1 in ${tfaTeamUniqueOdds(users.length)} per raid.`);
		}

		const lootTotal = totalLoot.totalLoot();
		if (lootTotal.length > 0) {
			await ClientSettings.updateBankSetting('tfa_loot', lootTotal);
		}
		await trackLoot({
			totalLoot: lootTotal,
			id: 'fractured_archive',
			type: 'Minigame',
			changeType: 'loot',
			duration,
			kc: completed,
			users: allUsers.map(u => ({ id: u.id, duration, loot: totalLoot.get(u.id) }))
		});

		if (shouldShowImage) {
			resultMessage.addChestLootImage({
				entries: allUsers.map((u, index) => ({
					loot: totalLoot.get(u.id),
					user: u,
					previousCL: previousCLs[index],
					customTexts: []
				})),
				type: RAID_NAME
			});
		}

		return handleTripFinish({
			user: allUsers[0],
			channelId,
			data,
			message: resultMessage
		});
	}
};
