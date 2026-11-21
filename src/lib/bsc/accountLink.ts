import { userMention } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';

import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';
import { GE_SLOTS_CACHE } from '@/lib/cache.js';
import { getEffectivePaidPatronLevel } from '@/lib/bsc/groupPatronPerks.js';
import { bscPatronTierByLevel } from '@/lib/bsc/patronTiers.js';
import { clearPerkTierHotCache } from '@/lib/perkTiers.js';

export const BSC_ACCOUNT_LINK_CONFIRM_MS = Time.Second * 90;
export const BSC_ACCOUNT_RELINK_COOLDOWN_PROD_MS = Time.Day * 7;
export const BSC_ACCOUNT_RELINK_COOLDOWN_TEST_MS = Time.Minute * 5;

export function bscAccountRelinkCooldownMs(env = process.env.BSC_ENV): number {
	return env === 'test' ? BSC_ACCOUNT_RELINK_COOLDOWN_TEST_MS : BSC_ACCOUNT_RELINK_COOLDOWN_PROD_MS;
}

export type AccountLinkRow = {
	mainId: string;
	ironId: string;
	linkedAt: Date;
};

export type LinkStartFailure =
	| 'self'
	| 'actor_is_iron'
	| 'target_not_iron'
	| 'actor_linked'
	| 'target_linked'
	| 'actor_cooldown'
	| 'target_cooldown';

export function evaluateLinkStart(input: {
	actorId: string;
	targetId: string;
	actorIsIron: boolean;
	targetIsIron: boolean;
	actorLink: AccountLinkRow | null;
	targetLink: AccountLinkRow | null;
	actorCooldownRemainingMs: number;
	targetCooldownRemainingMs: number;
}): { ok: true } | { ok: false; reason: LinkStartFailure; remainingMs?: number } {
	if (input.actorId === input.targetId) return { ok: false, reason: 'self' };
	if (input.actorIsIron) return { ok: false, reason: 'actor_is_iron' };
	if (!input.targetIsIron) return { ok: false, reason: 'target_not_iron' };
	if (input.actorLink) return { ok: false, reason: 'actor_linked' };
	if (input.targetLink) return { ok: false, reason: 'target_linked' };
	if (input.actorCooldownRemainingMs > 0) {
		return { ok: false, reason: 'actor_cooldown', remainingMs: input.actorCooldownRemainingMs };
	}
	if (input.targetCooldownRemainingMs > 0) {
		return { ok: false, reason: 'target_cooldown', remainingMs: input.targetCooldownRemainingMs };
	}
	return { ok: true };
}

export function relinkCooldownRemaining(lastUnlinkedAt: number | null, now: number, cooldownMs: number): number {
	if (!lastUnlinkedAt) return 0;
	const remaining = cooldownMs - (now - lastUnlinkedAt);
	return remaining > 0 ? remaining : 0;
}

const MENTION_PLACEHOLDER = '<@000000000000000000>';

export function linkStartFailureMessage(
	reason: LinkStartFailure,
	remainingMs = 0,
	targetMention = MENTION_PLACEHOLDER
): string {
	switch (reason) {
		case 'self':
			return 'You cannot link an account to itself.';
		case 'actor_is_iron':
			return 'The regular account has to start the link. On your main, use /patron link and pick this iron, then accept here.';
		case 'target_not_iron':
			return 'You can only link a regular account to one ironman account.';
		case 'actor_linked':
			return 'Your account is already linked. Use /patron unlink first if you want to change it.';
		case 'target_linked':
			return `${targetMention} is already linked to another account.`;
		case 'actor_cooldown':
			return `You can link again in ${formatDuration(remainingMs)}.`;
		case 'target_cooldown':
			return `${targetMention} can be linked again in ${formatDuration(remainingMs)}.`;
	}
}

export function linkRequestMessage(mainMention: string, ironMention: string): string {
	return `${ironMention}, ${mainMention} wants to link this ironman to their main. You will share their patron perks (not staff roles). Gift, mystery box and double loot cooldowns are shared, and items or GP cannot move between the accounts. Click Confirm to accept.`;
}

export function linkSuccessMessage(mainMention: string, ironMention: string): string {
	return `Linked ${mainMention} (main) and ${ironMention} (ironman). The iron now shares the main's patron perks. Gift, mystery box and double loot cooldowns are shared.`;
}

export function unlinkConfirmMessage(otherMention: string): string {
	return `Unlink your account from ${otherMention}? The iron will stop sharing patron perks. You will have to wait before linking again.`;
}

export function unlinkSuccessMessage(cooldownMs: number): string {
	return `Unlinked. You can link again in ${formatDuration(cooldownMs)}.`;
}

export function notLinkedStatusMessage(): string {
	return 'You are not linked to another account. A regular account can link to one ironman with /patron link, and the iron has to accept.';
}

export function linkedStatusMessage(input: {
	viewerIsIron: boolean;
	otherMention: string;
	tierName: string | null;
}): string {
	const who = input.viewerIsIron
		? `You are linked to ${input.otherMention} (main).`
		: `Your ironman is ${input.otherMention}.`;
	const perks = input.tierName
		? ` The iron shares ${input.tierName} perks from the main.`
		: ' The main has no paid patron tier to share right now.';
	return `${who}${perks} Gift, mystery box and double loot cooldowns are shared. Items and GP cannot move between the accounts. Use /patron unlink to remove the link.`;
}

export function cooldownRemainingFromRow(lastUnlinkedAt: Date | null, now: number, cooldownMs: number): number {
	return relinkCooldownRemaining(lastUnlinkedAt ? lastUnlinkedAt.getTime() : null, now, cooldownMs);
}

export async function getAccountLink(userId: string): Promise<AccountLinkRow | null> {
	const row = await prisma.bscAccountLink.findFirst({
		where: { OR: [{ main_id: userId }, { iron_id: userId }] }
	});
	if (!row) return null;
	return { mainId: row.main_id, ironId: row.iron_id, linkedAt: row.linked_at };
}

export async function getRelinkCooldownRemaining(userId: string, now = Date.now()): Promise<number> {
	const row = await prisma.bscAccountLinkCooldown.findUnique({ where: { user_id: userId } });
	return cooldownRemainingFromRow(row?.last_unlinked_at ?? null, now, bscAccountRelinkCooldownMs());
}

export async function resetLinkedPerkCaches(userId: string): Promise<void> {
	const group = await findGroupOfUser(userId);
	await Promise.all(
		group.map(async id => {
			clearPerkTierHotCache(id);
			await Cache.resetPerkTier(id);
			GE_SLOTS_CACHE.delete(id);
		})
	);
}

export async function createAccountLink(mainId: string, ironId: string): Promise<void> {
	await prisma.bscAccountLink.create({
		data: { main_id: mainId, iron_id: ironId }
	});
	await resetLinkedPerkCaches(mainId);
}

export async function deleteAccountLink(userId: string, now = Date.now()): Promise<AccountLinkRow | null> {
	const existing = await getAccountLink(userId);
	if (!existing) return null;
	const group = [existing.mainId, existing.ironId];
	await prisma.$transaction([
		prisma.bscAccountLink.delete({ where: { main_id: existing.mainId } }),
		...group.map(id =>
			prisma.bscAccountLinkCooldown.upsert({
				where: { user_id: id },
				create: { user_id: id, last_unlinked_at: new Date(now) },
				update: { last_unlinked_at: new Date(now) }
			})
		)
	]);
	await Promise.all(
		group.map(async id => {
			clearPerkTierHotCache(id);
			await Cache.resetPerkTier(id);
			GE_SLOTS_CACHE.delete(id);
		})
	);
	return existing;
}

export async function formatLinkStatus(user: MUser): Promise<string> {
	const link = await getAccountLink(user.id);
	if (!link) return notLinkedStatusMessage();
	const viewerIsIron = user.id === link.ironId;
	const otherId = viewerIsIron ? link.mainId : link.ironId;
	const main = viewerIsIron ? await mUserFetch(link.mainId) : user;
	const level = await getEffectivePaidPatronLevel(link.mainId, main.bitfield);
	const tierName = bscPatronTierByLevel(level)?.name ?? null;
	return linkedStatusMessage({
		viewerIsIron,
		otherMention: userMention(otherId),
		tierName
	});
}
