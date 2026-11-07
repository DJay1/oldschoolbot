import { Routes } from '@oldschoolgg/discord';

import { BitField } from '@/lib/constants.js';
import { withPatreonLink } from '@/lib/patreonLink.js';
import { getBscPatronOverride, saveBscPatronOverride } from './patronStore.js';
import {
	BSC_COSMETIC_COOLDOWN,
	BSC_PATRON_BITS,
	BSC_SUPPORTER_COSMETIC,
	bscPatronLevelFromBits,
	bscPatronLevelFromPatreonTierIds,
	bscPatronLevelFromRoles,
	bscPatronRolesConfigured,
	bscPatronTierByLevel,
	bscSupportServerId,
	patronBitsForLevel
} from './patronTiers.js';

export async function applyBscPatronTier(user: MUser, level: number): Promise<void> {
	const wanted = new Set(patronBitsForLevel(level));
	const kept = user.bitfield.filter(bit => !BSC_PATRON_BITS.includes(bit));
	const next = [...kept, ...wanted];
	const unchanged =
		next.length === user.bitfield.length && next.every(bit => user.bitfield.includes(bit as BitField));
	if (unchanged) return;
	await user.update({ bitfield: next });
	await user.fetchPerkTier({ forceNoCache: true });
}

/**
 * Role sync and the optional Patreon API both call this.
 * A manual /admin patron override is left alone.
 */
export async function syncBscPatronUser(user: MUser, level: number): Promise<'manual' | 'updated'> {
	const override = await getBscPatronOverride(user.id);
	if (override?.manual) return 'manual';
	await applyBscPatronTier(user, level);
	return 'updated';
}

export async function syncBscPatronFromRoles(userId: string, roleIds: readonly string[]): Promise<void> {
	if (!bscPatronRolesConfigured()) return;
	const override = await getBscPatronOverride(userId);
	if (override?.manual) return;
	const level = bscPatronLevelFromRoles(roleIds);
	const existing = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true }
	});
	if (!existing && level === 0) return;
	const user = await mUserFetch(userId);
	await applyBscPatronTier(user, level);
}

export async function handleBscGuildMemberUpdate(member: {
	guild_id?: string | null;
	roles?: string[] | null;
	user?: { id?: string | null } | null;
}): Promise<void> {
	const supportServer = bscSupportServerId();
	if (member.guild_id !== supportServer) return;
	const userId = member.user?.id;
	if (!userId) return;
	await syncBscPatronFromRoles(userId, member.roles ?? []);
}

export async function syncBscPatronGuildMembers(): Promise<void> {
	const guildId = bscSupportServerId();
	if (!bscPatronRolesConfigured()) return;
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
export function parseBscPatreonMembers(body: PatreonApiBody): Map<string, 0 | 1 | 2 | 3> {
	const discordByPatreonUser = new Map<string, string>();
	for (const included of body.included ?? []) {
		if (included.type !== 'user' || !included.id) continue;
		const discordId = included.attributes?.social_connections?.discord?.user_id;
		if (discordId) discordByPatreonUser.set(included.id, discordId);
	}
	const result = new Map<string, 0 | 1 | 2 | 3>();
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
		const user = await mUserFetch(userId);
		await applyBscPatronTier(user, level);
	}
	return 'synced';
}

export async function syncBscPatrons(): Promise<void> {
	await syncBscPatronGuildMembers();
	await syncBscPatreonApi();
}

export async function setBscPatronOverride(user: MUser, level: number, manual: boolean): Promise<string> {
	if (![0, 1, 2, 3].includes(level)) return 'Tier must be 0, 1, 2, or 3.';
	await saveBscPatronOverride({ userId: user.id, tier: level, manual });
	await applyBscPatronTier(user, level);
	const tier = bscPatronTierByLevel(level);
	const name = tier ? tier.name : 'no patron tier';
	const lock = manual ? 'Role sync will not change this.' : 'Role sync can change this on the next pass.';
	return `${user.usernameOrMention} is set to ${name} (tier ${level}). ${lock}`;
}

export async function claimBscSupporterCosmetic(user: MUser): Promise<string> {
	const level = bscPatronLevelFromBits(user.bitfield);
	if (level < 2) {
		return withPatreonLink('The monthly cosmetic is for Good Boy and Top Dog.');
	}
	const override = await getBscPatronOverride(user.id);
	const now = Date.now();
	if (override?.cosmeticClaimedAt && now - override.cosmeticClaimedAt < BSC_COSMETIC_COOLDOWN) {
		const wait = BSC_COSMETIC_COOLDOWN - (now - override.cosmeticClaimedAt);
		return `You already opened this month's cosmetic box. You can open another in ${Math.ceil(wait / (1000 * 60 * 60 * 24))} days.`;
	}
	await saveBscPatronOverride({
		userId: user.id,
		tier: override?.tier ?? level,
		manual: override?.manual ?? false,
		cosmeticClaimedAt: now
	});
	if (!user.bitfield.includes(BitField.BSCPatronCosmetic)) {
		await user.update({ bitfield: [...user.bitfield, BitField.BSCPatronCosmetic] });
	}
	return `You opened a cosmetic-only supporter box ${BSC_SUPPORTER_COSMETIC}. It has no coins, items, or lamps. The mark stays on your name.`;
}
