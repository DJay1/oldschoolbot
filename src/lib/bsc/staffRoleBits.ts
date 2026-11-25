import { Routes } from '@oldschoolgg/discord';

import { BitField, globalConfig } from '@/lib/constants.js';
import { STAFF_TIER_RANK, type StaffTier } from '@/lib/bsc/staffTiers.js';

export const BSC_STAFF_ROLE_BITS: readonly { bit: BitField; roleId: string }[] = [
	{ bit: BitField.Developer, roleId: '1569683439190286346' },
	{ bit: BitField.Contributor, roleId: '1569683812621881454' },
	{ bit: BitField.Moderator, roleId: '1325179339641458749' },
	// Head Mod gets the same Moderator tier as Mod.
	{ bit: BitField.Moderator, roleId: '1353916725086785646' }
];

export function staffRoleBitsEnabled(): boolean {
	return globalConfig.isProduction;
}

const DISCORD_ADMINISTRATOR = 8n;

/**
 * Roles in the support server with Discord's Administrator permission. Holding one gives the Moderator
 * bit only (bot Admin is ADMIN_USER_IDS, never a role). Ignores @everyone and bot-managed roles.
 */
export function administratorRoleIds(
	roles: readonly { id: string; permissions?: string | null; managed?: boolean | null }[],
	guildId: string
): string[] {
	return roles
		.filter(r => {
			if (r.id === guildId || r.managed) return false;
			try {
				return (BigInt(r.permissions ?? '0') & DISCORD_ADMINISTRATOR) === DISCORD_ADMINISTRATOR;
			} catch {
				return false;
			}
		})
		.map(r => r.id);
}

/**
 * adminRoleIds: roles with Administrator. null = unknown (the role fetch failed), so an existing
 * Moderator bit is kept rather than removed by mistake.
 */
export function staffBitChanges(
	bitfield: readonly number[],
	roleIds: readonly string[],
	adminRoleIds: readonly string[] | null = []
): { add: BitField[]; remove: BitField[] } {
	const add: BitField[] = [];
	const remove: BitField[] = [];
	const hasAdministrator = adminRoleIds !== null && roleIds.some(id => adminRoleIds.includes(id));
	// Several roles can grant the same bit (Mod and Head Mod), so a bit is kept if ANY of its roles is held.
	const bits = [...new Set(BSC_STAFF_ROLE_BITS.map(r => r.bit))];
	for (const bit of bits) {
		const viaAdministrator = bit === BitField.Moderator && hasAdministrator;
		const hasRole = BSC_STAFF_ROLE_BITS.some(r => r.bit === bit && roleIds.includes(r.roleId)) || viaAdministrator;
		const hasBit = bitfield.includes(bit);
		if (hasRole && !hasBit) add.push(bit);
		if (!hasRole && hasBit) {
			if (bit === BitField.Moderator && adminRoleIds === null) continue;
			remove.push(bit);
		}
	}
	return { add, remove };
}

/** Staff tier implied by support-server Discord roles. Contributor is not a staff tier. */
export function staffTierFromRoleIds(roleIds: readonly string[] | null | undefined): StaffTier {
	if (!roleIds || roleIds.length === 0) return 'none';
	const held = new Set(BSC_STAFF_ROLE_BITS.filter(r => roleIds.includes(r.roleId)).map(r => r.bit));
	if (held.has(BitField.Developer)) return 'developer';
	if (held.has(BitField.Moderator)) return 'moderator';
	return 'none';
}

export function higherStaffTier(a: StaffTier, b: StaffTier): StaffTier {
	return STAFF_TIER_RANK[a] >= STAFF_TIER_RANK[b] ? a : b;
}

/**
 * When a role payload would drop staff bits, prefer a freshly fetched member role list.
 * If that fetch failed, keep the bits (same idea as an unknown Administrator role list).
 * An explicit leave still uses the empty payload so bits can be cleared.
 */
export function resolvedRoleIdsForStaffSync(options: {
	payloadRoleIds: readonly string[];
	fetchedRoleIds: readonly string[] | null;
	left: boolean;
	wouldRemove: boolean;
}): { roleIds: readonly string[]; applyRemovals: boolean } {
	if (options.left || !options.wouldRemove) {
		return { roleIds: options.payloadRoleIds, applyRemovals: true };
	}
	if (options.fetchedRoleIds === null) {
		return { roleIds: options.payloadRoleIds, applyRemovals: false };
	}
	return { roleIds: options.fetchedRoleIds, applyRemovals: true };
}

const ADMIN_ROLE_CACHE_MS = 10 * 60 * 1000;
let adminRoleCache: { ids: string[]; at: number } | null = null;

/** Cached list of support server roles with Administrator. null if it could not be fetched yet. */
export async function getAdministratorRoleIds(force = false): Promise<string[] | null> {
	if (!staffRoleBitsEnabled()) return [];
	if (!force && adminRoleCache && Date.now() - adminRoleCache.at < ADMIN_ROLE_CACHE_MS) return adminRoleCache.ids;
	try {
		const guildId = globalConfig.supportServerID;
		const roles = (await globalClient.rest.get(Routes.guildRoles(guildId))) as {
			id: string;
			permissions?: string;
			managed?: boolean;
		}[];
		if (!Array.isArray(roles)) return adminRoleCache?.ids ?? null;
		adminRoleCache = { ids: administratorRoleIds(roles, guildId), at: Date.now() };
		return adminRoleCache.ids;
	} catch (err) {
		Logging.logError(err as Error);
		return adminRoleCache?.ids ?? null;
	}
}

async function fetchSupportMemberRoleIds(userId: string): Promise<string[] | null> {
	try {
		const member = (await globalClient.rest.get(Routes.guildMember(globalConfig.supportServerID, userId))) as {
			roles?: string[];
		};
		return member.roles ?? [];
	} catch {
		return null;
	}
}

export async function syncBscStaffBitsFromRoles(
	userId: string,
	roleIds: readonly string[],
	opts?: { left?: boolean }
): Promise<void> {
	if (!staffRoleBitsEnabled()) return;
	const existing = await prisma.user.findUnique({ where: { id: userId }, select: { bitfield: true } });
	if (!existing) return;
	const adminRoleIds = await getAdministratorRoleIds();
	const left = opts?.left === true;
	const preview = staffBitChanges(existing.bitfield, roleIds, adminRoleIds);
	const fetched = !left && preview.remove.length > 0 ? await fetchSupportMemberRoleIds(userId) : null;
	const resolved = resolvedRoleIdsForStaffSync({
		payloadRoleIds: roleIds,
		fetchedRoleIds: fetched,
		left,
		wouldRemove: preview.remove.length > 0
	});
	const { add, remove } = staffBitChanges(existing.bitfield, resolved.roleIds, adminRoleIds);
	const appliedRemove = resolved.applyRemovals ? remove : [];
	if (add.length === 0 && appliedRemove.length === 0) return;
	const user = await mUserFetch(userId);
	const next = [...user.bitfield.filter(bit => !appliedRemove.includes(bit)), ...add];
	await user.update({ bitfield: next });
	await user.fetchPerkTier({ forceNoCache: true });
}
