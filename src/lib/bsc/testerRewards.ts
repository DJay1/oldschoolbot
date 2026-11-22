import { uniqueArr } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank, Items } from 'oldschooljs';

import { BadgesEnum } from '@/lib/badges/badgeEmojis.js';
import { BitField } from '@/lib/constants.js';

export const TESTER_GIFT_BOX_ITEM_NAME = 'Tester Gift Box';
export const BUG_HUNTER_PET_NAME = 'Bug hunter';
export const BUG_HUNTER_PET_ID = 73_415;
export const TESTER_LAB_BG_ID = 1032;
export const TESTER_LAB_BG_NAME = 'Tester Lab';
export const BUG_HUNTER_TITLE = 'the Bug Hunter';

/** Guaranteed coins per Tester Gift box. Boosted from the 8-15m staff proposal after KoD's feedback. */
export const TESTER_GIFT_COINS = { min: 15_000_000, max: 25_000_000 } as const;

/**
 * Milestone thresholds.
 * Testers earn about 180 points a week, enough for about 12 boxes.
 * The badge needs boxes opened on a real `/open` plus a points-earned floor,
 * so buying traded boxes cannot unlock tester-only cosmetics by itself.
 * Title, Tester Lab, and the Bug hunter pet use lifetime tester points earned
 * (giveTesterPoints only; spends and refunds do not change earned_total).
 * The pet is a points milestone, not a 1/357 box drop, because the box is tradeable.
 */
export const TESTER_MILESTONES = {
	badgeBoxes: 10,
	badgeEarned: 150,
	titleEarned: 300,
	labEarned: 750,
	petEarned: 1500
} as const;

export type TesterProgress = {
	boxesOpened: number;
	earnedTotal: number;
	hasBadge: boolean;
	hasTitle: boolean;
	hasLab: boolean;
	hasPet: boolean;
};

export function testerGiftBoxId(): number {
	return Items.getOrThrow(TESTER_GIFT_BOX_ITEM_NAME).id;
}

export function nameWithTesterTitle(username: string, bitfield: readonly number[]): string {
	if (!bitfield.includes(BitField.HasBugHunterTitle)) return username;
	if (username.endsWith(` ${BUG_HUNTER_TITLE}`) || username === BUG_HUNTER_TITLE) return username;
	return `${username} ${BUG_HUNTER_TITLE}`;
}

export function milestoneEligibility(boxesOpened: number, earnedTotal: number) {
	return {
		badge: boxesOpened >= TESTER_MILESTONES.badgeBoxes && earnedTotal >= TESTER_MILESTONES.badgeEarned,
		title: earnedTotal >= TESTER_MILESTONES.titleEarned,
		lab: earnedTotal >= TESTER_MILESTONES.labEarned,
		pet: earnedTotal >= TESTER_MILESTONES.petEarned
	};
}

export function planShopSpend(
	testerBalance: number,
	developerBalance: number,
	cost: number
): { ok: true; testerSpend: number; developerSpend: number } | { ok: false } {
	if (!Number.isInteger(cost) || cost < 1) return { ok: false };
	if (!Number.isInteger(testerBalance) || testerBalance < 0) return { ok: false };
	if (!Number.isInteger(developerBalance) || developerBalance < 0) return { ok: false };
	if (testerBalance >= cost) {
		return { ok: true, testerSpend: cost, developerSpend: 0 };
	}
	if (testerBalance + developerBalance >= cost) {
		return { ok: true, testerSpend: testerBalance, developerSpend: cost - testerBalance };
	}
	return { ok: false };
}

export async function getTesterGiftBoxesOpened(user: MUser): Promise<number> {
	const scores = await user.fetchUserStat('openable_scores');
	return new Bank((scores ?? {}) as ItemBank).amount(testerGiftBoxId());
}

export function readTesterProgress(user: MUser, boxesOpened: number, earnedTotal: number): TesterProgress {
	return {
		boxesOpened,
		earnedTotal,
		hasBadge: user.user.badges.includes(BadgesEnum.Tester),
		hasTitle: user.bitfield.includes(BitField.HasBugHunterTitle),
		hasLab: user.bitfield.includes(BitField.HasTesterLabBackground),
		hasPet: user.owns(BUG_HUNTER_PET_NAME) || user.cl.has(BUG_HUNTER_PET_NAME)
	};
}

export function formatTesterUnlockProgress(progress: TesterProgress): string {
	const next = milestoneEligibility(progress.boxesOpened, progress.earnedTotal);
	const lines: string[] = ['**Tester unlocks**'];

	if (progress.hasBadge) {
		lines.push(`- Tester badge: unlocked (${progress.boxesOpened} boxes opened).`);
	} else {
		lines.push(
			`- Tester badge: ${progress.boxesOpened}/${TESTER_MILESTONES.badgeBoxes} boxes opened, ${progress.earnedTotal}/${TESTER_MILESTONES.badgeEarned} points earned.`
		);
	}

	const pointRows: { have: boolean; label: string; need: number }[] = [
		{ have: progress.hasTitle, label: `Title "${BUG_HUNTER_TITLE}"`, need: TESTER_MILESTONES.titleEarned },
		{ have: progress.hasLab, label: 'Tester Lab background', need: TESTER_MILESTONES.labEarned },
		{ have: progress.hasPet, label: 'Bug hunter pet', need: TESTER_MILESTONES.petEarned }
	];
	for (const row of pointRows) {
		if (row.have) {
			lines.push(`- ${row.label}: unlocked.`);
		} else {
			lines.push(`- ${row.label}: ${progress.earnedTotal}/${row.need} points earned.`);
		}
	}

	if (next.badge && !progress.hasBadge) {
		lines.push('Your Tester badge is ready to unlock.');
	}
	return lines.join('\n');
}

async function addBit(user: MUser, bit: BitField) {
	if (user.bitfield.includes(bit)) return;
	await user.update({ bitfield: uniqueArr([...user.bitfield, bit]) });
}

async function addBadge(user: MUser, badge: number) {
	if (user.user.badges.includes(badge)) return;
	await user.update({ badges: uniqueArr([...user.user.badges, badge]) });
}

/**
 * Grant any milestones the player has earned. Idempotent: already-owned
 * badges, bits, and the pet are not given again.
 */
export async function applyTesterMilestones(user: MUser, boxesOpened: number, earnedTotal: number): Promise<string[]> {
	const eligible = milestoneEligibility(boxesOpened, earnedTotal);
	const progress = readTesterProgress(user, boxesOpened, earnedTotal);
	const unlocked: string[] = [];

	if (eligible.badge && !progress.hasBadge) {
		await addBadge(user, BadgesEnum.Tester);
		unlocked.push('You unlocked the Tester badge.');
	}
	if (eligible.title && !progress.hasTitle) {
		await addBit(user, BitField.HasBugHunterTitle);
		unlocked.push(`You unlocked the title ${BUG_HUNTER_TITLE}.`);
	}
	if (eligible.lab && !progress.hasLab) {
		await addBit(user, BitField.HasTesterLabBackground);
		unlocked.push('You unlocked the Tester Lab bank background. Set it with `/minion bankbg name:Tester Lab`.');
	}
	if (eligible.pet && !progress.hasPet) {
		await user.addItemsToBank({
			items: new Bank().add(BUG_HUNTER_PET_NAME),
			collectionLog: true
		});
		unlocked.push('You unlocked the Bug hunter pet.');
	}

	return unlocked;
}
