import { Routes } from '@oldschoolgg/discord';

import { BitField, globalConfig } from '@/lib/constants.js';

export const BSC_STAFF_ROLE_BITS: readonly { bit: BitField; roleId: string }[] = [
	{ bit: BitField.Developer, roleId: '1569683439190286346' },
	{ bit: BitField.Contributor, roleId: '1569683812621881454' },
	{ bit: BitField.Moderator, roleId: '1325179339641458749' }
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
	for (const { bit, roleId } of BSC_STAFF_ROLE_BITS) {
		const viaAdministrator = bit === BitField.Moderator && hasAdministrator;
		const hasRole = roleIds.includes(roleId) || viaAdministrator;
		const hasBit = bitfield.includes(bit);
		if (hasRole && !hasBit) add.push(bit);
		if (!hasRole && hasBit) {
			if (bit === BitField.Moderator && adminRoleIds === null) continue;
			remove.push(bit);
		}
	}
	return { add, remove };
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

export async function syncBscStaffBitsFromRoles(userId: string, roleIds: readonly string[]): Promise<void> {
	if (!staffRoleBitsEnabled()) return;
	const existing = await prisma.user.findUnique({ where: { id: userId }, select: { bitfield: true } });
	if (!existing) return;
	const adminRoleIds = await getAdministratorRoleIds();
	const { add, remove } = staffBitChanges(existing.bitfield, roleIds, adminRoleIds);
	if (add.length === 0 && remove.length === 0) return;
	const user = await mUserFetch(userId);
	const next = [...user.bitfield.filter(bit => !remove.includes(bit)), ...add];
	await user.update({ bitfield: next });
	await user.fetchPerkTier({ forceNoCache: true });
}
