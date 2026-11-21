import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';

import { getBscPatronOverride, updateBscPatronOverride } from '@/lib/bsc/patronStore.js';
import {
	type BscPatronLevel,
	bscActiveGiftLevel,
	bscPatronLevelFromBits,
	bscPatronTierByLevel
} from '@/lib/bsc/patronTiers.js';

export async function getEffectivePaidPatronLevel(
	userId: string,
	ownBits: readonly number[],
	now = Date.now()
): Promise<BscPatronLevel> {
	let level: BscPatronLevel = bscPatronLevelFromBits(ownBits);
	const group = await findGroupOfUser(userId);
	const ids = group.length > 0 ? group : [userId];
	const users = await prisma.user.findMany({
		where: { id: { in: ids } },
		select: { id: true, bitfield: true }
	});
	for (const member of users) {
		const paid = bscPatronLevelFromBits(member.id === userId ? ownBits : member.bitfield);
		if (paid > level) level = paid;
		level = await addOverrideLevels(member.id, level, now);
	}
	if (!users.some(member => member.id === userId)) {
		level = await addOverrideLevels(userId, level, now);
	}
	return level;
}

async function addOverrideLevels(userId: string, level: BscPatronLevel, now: number): Promise<BscPatronLevel> {
	const override = await getBscPatronOverride(userId);
	if (!override) return level;
	const gift = bscActiveGiftLevel(override.giftTier, override.giftUntil, now);
	const reward = bscActiveGiftLevel(override.rewardTier, override.rewardUntil, now);
	return Math.max(level, gift, reward) as BscPatronLevel;
}

/** Paid and gifted/rewarded perk tiers from *other* linked accounts only. Never staff bits. */
export async function getLinkedPaidPerkSources(
	userId: string,
	now = Date.now()
): Promise<{ tiers: number[]; timedEnds: number[] }> {
	const group = await findGroupOfUser(userId);
	const others = group.filter(id => id !== userId);
	const tiers: number[] = [];
	const timedEnds: number[] = [];
	if (others.length === 0) return { tiers, timedEnds };

	const users = await prisma.user.findMany({
		where: { id: { in: others } },
		select: { id: true, bitfield: true }
	});
	for (const other of users) {
		const paid = bscPatronLevelFromBits(other.bitfield);
		const perk = bscPatronTierByLevel(paid)?.perkTier;
		if (perk) tiers.push(perk);
		const override = await getBscPatronOverride(other.id);
		if (!override) continue;
		const giftLevel = bscActiveGiftLevel(override.giftTier, override.giftUntil, now);
		const giftPerk = bscPatronTierByLevel(giftLevel)?.perkTier;
		if (giftPerk) {
			tiers.push(giftPerk);
			if (override.giftUntil) timedEnds.push(override.giftUntil);
		}
		const rewardLevel = bscActiveGiftLevel(override.rewardTier, override.rewardUntil, now);
		const rewardPerk = bscPatronTierByLevel(rewardLevel)?.perkTier;
		if (rewardPerk) {
			tiers.push(rewardPerk);
			if (override.rewardUntil) timedEnds.push(override.rewardUntil);
		}
	}
	return { tiers, timedEnds };
}

export async function getGroupLastGiftAt(userId: string): Promise<number | null> {
	const group = await findGroupOfUser(userId);
	let latest: number | null = null;
	for (const id of group) {
		const state = await getBscPatronOverride(id);
		if (state?.lastGiftAt && (latest === null || state.lastGiftAt > latest)) latest = state.lastGiftAt;
	}
	return latest;
}

export async function stampGroupLastGiftAt(userId: string, at: number): Promise<void> {
	const group = await findGroupOfUser(userId);
	await Promise.all(group.map(id => updateBscPatronOverride(id, { lastGiftAt: at })));
}

export async function getGroupLastGivenBoxx(userId: string): Promise<number> {
	const group = await findGroupOfUser(userId);
	const rows = await prisma.user.findMany({
		where: { id: { in: group } },
		select: { lastGivenBoxx: true }
	});
	let latest = 0;
	for (const row of rows) {
		const value = Number(row.lastGivenBoxx ?? 0);
		if (value > latest) latest = value;
	}
	return latest;
}

export async function stampGroupLastGivenBoxx(userId: string, at: number): Promise<void> {
	const group = await findGroupOfUser(userId);
	await prisma.user.updateMany({
		where: { id: { in: group } },
		data: { lastGivenBoxx: at }
	});
}

export async function getGroupCosmeticClaimedAt(userId: string): Promise<number | null> {
	const group = await findGroupOfUser(userId);
	let latest: number | null = null;
	for (const id of group) {
		const state = await getBscPatronOverride(id);
		if (state?.cosmeticClaimedAt && (latest === null || state.cosmeticClaimedAt > latest)) {
			latest = state.cosmeticClaimedAt;
		}
	}
	return latest;
}

export async function stampGroupCosmeticClaimedAt(userId: string, at: number): Promise<void> {
	const group = await findGroupOfUser(userId);
	await Promise.all(
		group.map(async id => {
			const current = await getBscPatronOverride(id);
			await updateBscPatronOverride(id, {
				tier: current?.tier ?? 0,
				manual: current?.manual ?? false,
				cosmeticClaimedAt: at
			});
		})
	);
}
