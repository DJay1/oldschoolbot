import { customEmoji } from '@oldschoolgg/toolkit';
import { Routes } from '@oldschoolgg/discord';

import { creditMonthlyPatronRewards } from '@/lib/bsc/patronPoints.js';
import { GE_SLOTS_CACHE } from '@/lib/cache.js';
import { BitField } from '@/lib/constants.js';
import { withPatreonLink } from '@/lib/patreonLink.js';
import { type BscPatronOverride, getBscPatronOverride, updateBscPatronOverride } from './patronStore.js';
import {
	BSC_COSMETIC_COOLDOWN,
	BSC_PATRON_BITS,
	type BscPatronLevel,
	bscPatronLevelFromBits,
	bscPatronLevelFromPatreonTierIds,
	bscPatronLevelFromRoles,
	bscPatronRoleChanges,
	bscPatronRolesConfigured,
	bscPatronTierByLevel,
	bscStaffLevelFromRoles,
	bscSupportServerId,
	decideBscPatronSync,
	nextBscCustomBackground,
	patronBitsForLevel,
	warnBlankBscPatronRoles
} from './patronTiers.js';
import { playerRoleEnabled, syncBscPlayerRole } from './playerRole.js';
import { staffRoleBitsEnabled, syncBscStaffBitsFromRoles } from './staffRoleBits.js';

export async function applyBscPatronTier(user: MUser, level: number): Promise<void> {
	const wanted = new Set(patronBitsForLevel(level));
	const kept = user.bitfield.filter(bit => !BSC_PATRON_BITS.includes(bit));
	const next = [...kept, ...wanted];
	const unchanged =
		next.length === user.bitfield.length && next.every(bit => user.bitfield.includes(bit as BitField));
	if (unchanged) {
		await user.fetchPerkTier({ forceNoCache: true });
		return;
	}
	await user.update({ bitfield: next });
	GE_SLOTS_CACHE.delete(user.id);
	await user.fetchPerkTier({ forceNoCache: true });
}

async function persistPatronLevel(
	user: MUser,
	level: number,
	patch: Partial<Omit<BscPatronOverride, 'userId'>>
): Promise<void> {
	const state = await getBscPatronOverride(user.id);
	const custom = patch.customBackground ?? nextBscCustomBackground(level, state?.customBackground ?? false);
	const previousId = state?.customBackgroundId ?? null;
	if (!custom && previousId != null && user.user.bankBackground === previousId) {
		await user.update({ bankBackground: 1 });
	}
	await applyBscPatronTier(user, level);
	await updateBscPatronOverride(user.id, {
		tier: level,
		roleMissingSince: patch.roleMissingSince ?? null,
		customBackground: custom,
		customBackgroundId: custom ? (patch.customBackgroundId ?? previousId) : null,
		...patch
	});
}

/**
 * Role sync and the optional Patreon API both call this.
 * A manual /admin patron override is left alone.
 */
export async function syncBscPatronUser(user: MUser, level: number): Promise<'manual' | 'updated'> {
	const override = await getBscPatronOverride(user.id);
	if (override?.manual) return 'manual';
	await persistPatronLevel(user, level, {
		roleMissingSince: null,
		customBackground: nextBscCustomBackground(level, override?.customBackground ?? false)
	});
	return 'updated';
}

export async function alignBscPatronRoles(
	userId: string,
	level: number,
	currentRoleIds: readonly string[]
): Promise<void> {
	const changes = bscPatronRoleChanges(currentRoleIds, level);
	if (!changes.add && changes.remove.length === 0) return;
	const guildId = bscSupportServerId();
	if (changes.add) {
		await globalClient.giveRole(guildId, userId, changes.add).catch(err => {
			Logging.logDebug(`BSC patron: could not add role ${changes.add} to ${userId}`, {
				error: (err as Error).message
			});
		});
	}
	for (const roleId of changes.remove) {
		await globalClient.takeRole(guildId, userId, roleId).catch(err => {
			Logging.logDebug(`BSC patron: could not remove role ${roleId} from ${userId}`, {
				error: (err as Error).message
			});
		});
	}
}

export async function syncBscPatronFromRoles(userId: string, roleIds: readonly string[]): Promise<void> {
	if (!bscPatronRolesConfigured()) return;
	const state = await getBscPatronOverride(userId);
	if (state?.manual) return;
	const paidLevel = bscPatronLevelFromRoles(roleIds);
	const staffLevel = bscStaffLevelFromRoles(roleIds);
	const roleLevel = Math.max(paidLevel, staffLevel);
	if (roleLevel === 0 && !state) {
		const existing = await prisma.user.findUnique({
			where: { id: userId },
			select: { bitfield: true }
		});
		if (!existing || bscPatronLevelFromBits(existing.bitfield) === 0) return;
	}

	const user = await mUserFetch(userId);
	const bitLevel = bscPatronLevelFromBits(user.bitfield);
	const decision = decideBscPatronSync({
		roleLevel,
		now: Date.now(),
		state: {
			manual: false,
			tier: bitLevel,
			roleMissingSince: state?.roleMissingSince ?? null,
			customBackground: state?.customBackground ?? false
		}
	});
	if (decision.skip) return;

	// Staff perks don't hand out a Patreon tier role, so leave their roles alone.
	const staffDriven = staffLevel > paidLevel;
	const changes =
		decision.reconcileRoles && !staffDriven
			? bscPatronRoleChanges(roleIds, decision.level)
			: { add: null, remove: [] };
	const sameLevel = decision.level === bitLevel;
	const sameGrace = (decision.roleMissingSince ?? null) === (state?.roleMissingSince ?? null);
	const sameCustom = decision.customBackground === (state?.customBackground ?? false);
	const rolesClean = !changes.add && changes.remove.length === 0;
	if (sameLevel && sameGrace && sameCustom && rolesClean) {
		if (paidLevel > 0) await creditMonthlyPatronRewards(userId, paidLevel);
		return;
	}

	await persistPatronLevel(user, decision.level, {
		roleMissingSince: decision.roleMissingSince,
		customBackground: decision.customBackground
	});
	if (paidLevel > 0) await creditMonthlyPatronRewards(userId, paidLevel);
	if (!rolesClean) await alignBscPatronRoles(userId, decision.level, roleIds);
}

export async function handleBscGuildMemberUpdate(
	member: {
		guild_id?: string | null;
		roles?: string[] | null;
		user?: { id?: string | null } | null;
	},
	{ left = false }: { left?: boolean } = {}
): Promise<void> {
	const supportServer = bscSupportServerId();
	if (member.guild_id !== supportServer) return;
	const userId = member.user?.id;
	if (!userId) return;
	await syncBscPatronFromRoles(userId, member.roles ?? []);
	await syncBscStaffBitsFromRoles(userId, member.roles ?? []);
	if (!left) await syncBscPlayerRole(userId, member.roles ?? []);
}

export async function handleBscGuildMemberRemove(member: {
	guild_id?: string | null;
	user?: { id?: string | null } | null;
}): Promise<void> {
	await handleBscGuildMemberUpdate({ ...member, roles: [] }, { left: true });
}

export async function syncBscPatronGuildMembers(): Promise<void> {
	const guildId = bscSupportServerId();
	if (!bscPatronRolesConfigured() && !staffRoleBitsEnabled() && !playerRoleEnabled()) return;
	let after: string | undefined;
	for (let page = 0; page < 5; page++) {
		const query = new URLSearchParams({ limit: '1000' });
		if (after) query.set('after', after);
		const members = (await globalClient.rest.get(Routes.guildMembers(guildId), {
			query
		})) as { user?: { id: string }; roles?: string[] }[];
		if (!Array.isArray(members) || members.length === 0) return;
		for (const member of members) {
			if (!member.user?.id) continue;
			await syncBscPatronFromRoles(member.user.id, member.roles ?? []);
			await syncBscStaffBitsFromRoles(member.user.id, member.roles ?? []);
			await syncBscPlayerRole(member.user.id, member.roles ?? []);
		}
		if (members.length < 1000) return;
		after = members[members.length - 1]?.user?.id;
		if (!after) return;
	}
}

interface PatreonApiBody {
	data?: {
		attributes?: { patron_status?: string };
		relationships?: {
			user?: { data?: { id?: string } };
			currently_entitled_tiers?: { data?: { id?: string }[] };
		};
	}[];
	included?: {
		type?: string;
		id?: string;
		attributes?: { social_connections?: { discord?: { user_id?: string } | null } };
	}[];
}

/** Optional Patreon API v2 sync. Returns null when the creator token is not configured. */
export function parseBscPatreonMembers(body: PatreonApiBody): Map<string, BscPatronLevel> {
	const discordByPatreonUser = new Map<string, string>();
	for (const included of body.included ?? []) {
		if (included.type !== 'user' || !included.id) continue;
		const discordId = included.attributes?.social_connections?.discord?.user_id;
		if (discordId) discordByPatreonUser.set(included.id, discordId);
	}
	const result = new Map<string, BscPatronLevel>();
	for (const member of body.data ?? []) {
		if (member.attributes?.patron_status !== 'active_patron') continue;
		const patreonUserId = member.relationships?.user?.data?.id;
		if (!patreonUserId) continue;
		const discordId = discordByPatreonUser.get(patreonUserId);
		if (!discordId) continue;
		const entitled = (member.relationships?.currently_entitled_tiers?.data ?? [])
			.map(tier => tier.id)
			.filter((id): id is string => Boolean(id));
		const level = bscPatronLevelFromPatreonTierIds(entitled);
		const previous = result.get(discordId) ?? 0;
		if (level > previous) result.set(discordId, level);
	}
	return result;
}

export async function fetchSupportMemberRoleIds(userId: string): Promise<string[] | null> {
	try {
		const member = (await globalClient.rest.get(Routes.guildMember(bscSupportServerId(), userId))) as {
			roles?: string[];
		};
		return member.roles ?? [];
	} catch {
		return null;
	}
}

export async function syncBscPatreonApi(): Promise<'skipped' | 'synced'> {
	const token = process.env.PATREON_CREATOR_TOKEN?.trim();
	const campaign = process.env.PATREON_CAMPAIGN_ID?.trim();
	if (!token || !campaign) return 'skipped';
	const url = new URL(`https://www.patreon.com/api/oauth2/v2/campaigns/${campaign}/members`);
	url.searchParams.set('include', 'user,currently_entitled_tiers');
	url.searchParams.set('fields[member]', 'patron_status');
	url.searchParams.set('fields[user]', 'social_connections');
	url.searchParams.set('page[count]', '1000');
	const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!response.ok) {
		Logging.logError(new Error(`BSC Patreon API responded ${response.status}`));
		return 'synced';
	}
	const parsed = parseBscPatreonMembers((await response.json()) as PatreonApiBody);
	for (const [userId, level] of parsed) {
		const override = await getBscPatronOverride(userId);
		if (override?.manual) continue;
		const roles = await fetchSupportMemberRoleIds(userId);
		if (roles) await alignBscPatronRoles(userId, level, roles);
		const user = await mUserFetch(userId);
		await persistPatronLevel(user, level, {
			roleMissingSince: null,
			customBackground: nextBscCustomBackground(level, override?.customBackground ?? false)
		});
		if (level > 0) await creditMonthlyPatronRewards(userId, level);
	}
	return 'synced';
}

export async function syncBscPatrons(): Promise<void> {
	warnBlankBscPatronRoles();
	await syncBscPatreonApi();
	await syncBscPatronGuildMembers();
}

export async function setBscPatronOverride(user: MUser, level: number, manual: boolean): Promise<string> {
	if (!Number.isInteger(level) || level < 0 || level > 6) {
		return 'Tier must be 0 to 6, or a name: none, pup, goodboy, topdog, alpha, packleader, biggestofdogs.';
	}
	const state = await getBscPatronOverride(user.id);
	await persistPatronLevel(user, level, {
		manual,
		roleMissingSince: null,
		customBackground: nextBscCustomBackground(level, state?.customBackground ?? false)
	});
	const tier = bscPatronTierByLevel(level);
	const name = tier ? tier.name : 'no patron tier';
	const lock = manual ? 'Role sync will not change this.' : 'Role sync can change this on the next pass.';
	return `${user.usernameOrMention} is set to ${name} (tier ${level}). ${lock}`;
}

export async function claimBscSupporterCosmetic(user: MUser): Promise<string> {
	const level = bscPatronLevelFromBits(user.bitfield);
	if (level < 2) {
		return withPatreonLink('The monthly cosmetic is for Good Boy and above.');
	}
	const override = await getBscPatronOverride(user.id);
	const now = Date.now();
	if (override?.cosmeticClaimedAt && now - override.cosmeticClaimedAt < BSC_COSMETIC_COOLDOWN) {
		const wait = BSC_COSMETIC_COOLDOWN - (now - override.cosmeticClaimedAt);
		return `You already opened this month's cosmetic box. You can open another in ${Math.ceil(wait / (1000 * 60 * 60 * 24))} days.`;
	}
	await updateBscPatronOverride(user.id, {
		tier: override?.tier && override.tier > 0 ? override.tier : level,
		manual: override?.manual ?? false,
		cosmeticClaimedAt: now
	});
	if (!user.bitfield.includes(BitField.BSCPatronCosmetic)) {
		await user.update({ bitfield: [...user.bitfield, BitField.BSCPatronCosmetic] });
	}
	return `You opened a cosmetic-only supporter box ${customEmoji('patron_collar')}. It has no coins, items, or lamps. The mark stays on your name.`;
}
