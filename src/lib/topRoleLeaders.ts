import { convertXPtoLVL, type ItemBank } from 'oldschooljs';

import { Prisma } from '@/prisma/main.js';
import { badgeEmoji } from '@/lib/badges/badgeEmojis.js';
import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { BadgesEnum, MAX_LEVEL } from '@/lib/constants.js';
import { getCollectionItems } from '@/lib/data/Collections.js';
import { Minigames } from '@/lib/settings/minigames.js';
import { TeamLoot } from '@/lib/simulation/TeamLoot.js';
import { type SkillNameType, SkillsArray } from '@/lib/skilling/types.js';
import { fetchCLLeaderboard } from '@/lib/util/clLeaderboard.js';

/** Discord message content limit. */
export const DISCORD_CONTENT_LIMIT = 2000;

/** Leave 150 characters of headroom under the Discord content limit. */
export const DISCORD_CONTENT_SAFE = DISCORD_CONTENT_LIMIT - 150;

const NAME_MAX = 32;

export interface TopRolePlace {
	userID: string;
	reason: string;
}

export interface TopRoleStanding {
	key: string;
	title: string;
	badge: number;
	leader: TopRolePlace | null;
	runnerUp: TopRolePlace | null;
}

/** The Top roles SEKZ asked to see, in display order. */
export const TOP_ROLE_TITLES = [
	{ key: 'sotw', title: 'Skiller of the Week', badge: BadgesEnum.SotWTrophy },
	{ key: 'collector', title: 'Collector', badge: BadgesEnum.TopCollector },
	{ key: 'sacrificer', title: 'Sacrificer', badge: BadgesEnum.TopSacrifice },
	{ key: 'skiller', title: 'Skiller', badge: BadgesEnum.TopSkiller },
	{ key: 'slayer', title: 'Slayer', badge: BadgesEnum.Slayer },
	{ key: 'clue_hunter', title: 'Clue Hunter', badge: BadgesEnum.TopClueHunter },
	{ key: 'minigamer', title: 'Minigamer', badge: BadgesEnum.TopMinigame },
	{ key: 'farmer', title: 'Farmer', badge: BadgesEnum.Farmer },
	{ key: 'giveawayer', title: 'Giveawayer', badge: BadgesEnum.TopGiveawayer }
] as const;

function twoPlaces(rows: { id: string; reason?: string }[]): {
	leader: TopRolePlace | null;
	runnerUp: TopRolePlace | null;
} {
	const unique: TopRolePlace[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		if (!row.id || seen.has(row.id)) continue;
		seen.add(row.id);
		unique.push({ userID: row.id, reason: row.reason ?? '' });
		if (unique.length === 2) break;
	}
	return { leader: unique[0] ?? null, runnerUp: unique[1] ?? null };
}

function standing(
	def: (typeof TOP_ROLE_TITLES)[number],
	places: { leader: TopRolePlace | null; runnerUp: TopRolePlace | null }
): TopRoleStanding {
	return { key: def.key, title: def.title, badge: def.badge, ...places };
}

const minigameColumns = Minigames.map(game => game.column).filter(i => i !== 'tithe_farm');

/** Same giveaway channels the weekly role refresh uses. */
const GIVEAWAY_CHANNELS = [
	'792691343284764693',
	'732207379818479756',
	'342983479501389826',
	'982989775399174184',
	'346304390858145792'
];

async function fetchSkillerOfTheWeek() {
	// There is no weekly XP contest in code. Show current SotW trophy holders.
	const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
		`SELECT id FROM users WHERE badges @> ARRAY[${BadgesEnum.SotWTrophy}]::int[] LIMIT 2;`
	);
	return twoPlaces(rows.map(r => ({ id: r.id, reason: 'SotW trophy' })));
}

async function fetchSkiller() {
	// Same total-level ranking as rolesTask.topSkillers (top 200 by total XP, then total level).
	const top200TotalXPUsers = await prisma.$queryRawUnsafe<
		({ id: string; totalxp: bigint } & Record<`skills.${SkillNameType}`, bigint>)[]
	>(
		`SELECT id, ${SkillsArray.map(s => `"skills.${s}"`)}, ${SkillsArray.map(s => `"skills.${s}"::bigint`).join(
			' + '
		)} as totalxp FROM users ORDER BY totalxp DESC LIMIT 200;`
	);

	const ranked = top200TotalXPUsers
		.map(u => {
			let totalLevel = 0;
			for (const skill of SkillsArray) {
				totalLevel += convertXPtoLVL(Number(u[`skills.${skill}`]), MAX_LEVEL);
			}
			return { id: u.id, totalLevel };
		})
		.sort((a, b) => b.totalLevel - a.totalLevel);

	return twoPlaces(ranked.map(u => ({ id: u.id, reason: `Total level ${u.totalLevel}` })));
}

async function fetchCollector() {
	const items = getCollectionItems('overall');
	const result = await fetchCLLeaderboard({
		ironmenOnly: false,
		items,
		resultLimit: 2,
		clName: 'overall'
	});
	const users = result?.users ?? [];
	return twoPlaces(users.map(u => ({ id: u.id, reason: 'Overall collection log' })));
}

async function fetchSacrificer() {
	const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
		`SELECT id FROM users ORDER BY "sacrificedValue" DESC LIMIT 2;`
	);
	return twoPlaces(rows.map(r => ({ id: r.id, reason: 'Most value sacrificed' })));
}

async function fetchSlayer() {
	const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
		`SELECT id FROM users WHERE "slayer.points" > 50 ORDER BY "slayer.points" DESC LIMIT 2;`
	);
	return twoPlaces(rows.map(r => ({ id: r.id, reason: 'Most slayer points' })));
}

async function fetchClueHunter() {
	const sumExpr = ClueTiers.map(t => `COALESCE((openable_scores->>'${t.id}')::int, 0)`).join(' + ');
	const rows = await prisma.$queryRawUnsafe<{ id: string; qty: number }[]>(
		`SELECT user_id::text AS id, (${sumExpr}) AS qty
FROM user_stats
ORDER BY qty DESC
LIMIT 2;`
	);
	return twoPlaces(rows.filter(r => r.qty > 0).map(r => ({ id: r.id, reason: 'Most clues opened' })));
}

async function fetchMinigamer() {
	if (minigameColumns.length === 0) return twoPlaces([]);
	const sumExpr = minigameColumns.map(col => `"${col}"`).join(' + ');
	const rows = await prisma.$queryRawUnsafe<{ id: string; qty: number }[]>(
		`SELECT user_id::text AS id, (${sumExpr}) AS qty
FROM minigames
ORDER BY qty DESC
LIMIT 2;`
	);
	return twoPlaces(rows.filter(r => r.qty > 0).map(r => ({ id: r.id, reason: 'Most minigame score' })));
}

async function fetchFarmer() {
	const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
		`SELECT id
FROM users
WHERE "minion.farmingContract" IS NOT NULL
ORDER BY ("minion.farmingContract"->>'contractsCompleted')::int DESC
LIMIT 2;`
	);
	return twoPlaces(rows.map(r => ({ id: r.id, reason: 'Most farming contracts' })));
}

async function fetchGiveawayer() {
	const res = await prisma.$queryRaw<{ user_id: string; qty: number }[]>`SELECT user_id, COUNT(user_id)::int AS qty
	FROM giveaway
	WHERE channel_id IN (${Prisma.join(GIVEAWAY_CHANNELS)})
	AND user_id NOT IN ('157797566833098752')
	GROUP BY user_id
	ORDER BY qty DESC
	LIMIT 50;`;
	const userIDsToCheck = res.map(i => i.user_id);
	if (userIDsToCheck.length === 0) return twoPlaces([]);

	const giveawayBank = new TeamLoot();
	const giveaways = await prisma.giveaway.findMany({
		where: {
			channel_id: { in: GIVEAWAY_CHANNELS },
			user_id: { in: userIDsToCheck }
		}
	});
	if (giveaways.length === 0) return twoPlaces([]);

	for (const giveaway of giveaways) {
		giveawayBank.add(giveaway.user_id, giveaway.loot as ItemBank);
	}

	const ranked = giveawayBank
		.entries()
		.sort((a, b) => b[1].value() - a[1].value())
		.map(([id, loot]) => ({ id, reason: `Most value given away (${loot.value()})` }));
	return twoPlaces(ranked);
}

/** Read-only standings. Does not assign Discord roles or badges. */
export async function fetchTopRoleStandings(): Promise<TopRoleStanding[]> {
	const defs = Object.fromEntries(TOP_ROLE_TITLES.map(d => [d.key, d])) as Record<
		(typeof TOP_ROLE_TITLES)[number]['key'],
		(typeof TOP_ROLE_TITLES)[number]
	>;
	const [sotw, collector, sacrificer, skiller, slayer, clue, minigamer, farmer, giveawayer] = await Promise.all([
		fetchSkillerOfTheWeek(),
		fetchCollector(),
		fetchSacrificer(),
		fetchSkiller(),
		fetchSlayer(),
		fetchClueHunter(),
		fetchMinigamer(),
		fetchFarmer(),
		fetchGiveawayer()
	]);
	return [
		standing(defs.sotw, sotw),
		standing(defs.collector, collector),
		standing(defs.sacrificer, sacrificer),
		standing(defs.skiller, skiller),
		standing(defs.slayer, slayer),
		standing(defs.clue_hunter, clue),
		standing(defs.minigamer, minigamer),
		standing(defs.farmer, farmer),
		standing(defs.giveawayer, giveawayer)
	];
}

export function safeDisplayName(name: string | null | undefined): string {
	const cleaned = (name ?? 'Unknown').replace(/\s+/g, ' ').trim() || 'Unknown';
	return cleaned.length > NAME_MAX ? cleaned.slice(0, NAME_MAX) : cleaned;
}

/**
 * Short, no-ping listing of each Top role's current leader and runner-up.
 * Uses badge emojis from badgeEmojis.ts only. Names are plain text (no mentions).
 */
export function formatTopRoleStandings(standings: TopRoleStanding[], names: Record<string, string>): string {
	const lines = ['**Top roles**'];
	for (const row of standings) {
		const badge = badgeEmoji(row.badge);
		const badgePrefix = badge ? `${badge} ` : '';
		const leader = row.leader ? safeDisplayName(names[row.leader.userID]) : 'None yet';
		let line = `${badgePrefix}**${row.title}:** ${leader}`;
		if (row.runnerUp) {
			line += `  •  2nd ${safeDisplayName(names[row.runnerUp.userID])}`;
		}
		lines.push(line);
	}
	return lines.join('\n');
}
