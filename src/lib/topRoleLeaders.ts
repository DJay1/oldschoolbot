import { toTitleCase } from '@oldschoolgg/toolkit';
import { convertXPtoLVL, type ItemBank } from 'oldschooljs';

import { Prisma } from '@/prisma/main.js';
import { badgeEmoji } from '@/lib/badges/badgeEmojis.js';
import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { BadgesEnum, MAX_LEVEL } from '@/lib/constants.js';
import { getCollectionItems } from '@/lib/data/Collections.js';
import { Minigames } from '@/lib/settings/minigames.js';
import { TeamLoot } from '@/lib/simulation/TeamLoot.js';
import { type SkillNameType, SkillsArray } from '@/lib/skilling/types.js';
import { fetchCLLeaderboard, fetchMultipleCLLeaderboards } from '@/lib/util/clLeaderboard.js';

/** Discord message content limit. */
export const DISCORD_CONTENT_LIMIT = 2000;

/** Leave 150 characters of headroom under the Discord content limit. */
export const DISCORD_CONTENT_SAFE = DISCORD_CONTENT_LIMIT - 150;

const NAME_MAX = 32;
const OVERVIEW_PLACES = 3;
const BREAKDOWN_PLACES = 5;

export interface TopRolePlace {
	userID: string;
	reason: string;
}

export interface TopRoleStanding {
	key: string;
	title: string;
	badge: number;
	places: TopRolePlace[];
}

export interface TopRoleCategoryEntry {
	label: string;
	userID: string;
}

export interface TopRoleBreakdown {
	key: string;
	title: string;
	badge: number;
	scoring: string;
	overallTitle: string;
	overall: TopRolePlace[];
	categoryHeading?: string;
	categories?: TopRoleCategoryEntry[];
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

export type TopRoleKey = (typeof TOP_ROLE_TITLES)[number]['key'];

export const TOP_ROLE_CHOICES = TOP_ROLE_TITLES.map(def => ({ name: def.title, value: def.key }));

export function isTopRoleKey(value: string | undefined): value is TopRoleKey {
	return TOP_ROLE_TITLES.some(def => def.key === value);
}

function roleDef(key: TopRoleKey) {
	return TOP_ROLE_TITLES.find(def => def.key === key)!;
}

function nPlaces(rows: { id: string; reason?: string }[], n: number): TopRolePlace[] {
	const unique: TopRolePlace[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		if (!row.id || seen.has(row.id)) continue;
		seen.add(row.id);
		unique.push({ userID: row.id, reason: row.reason ?? '' });
		if (unique.length === n) break;
	}
	return unique;
}

function standing(def: (typeof TOP_ROLE_TITLES)[number], places: TopRolePlace[]): TopRoleStanding {
	return { key: def.key, title: def.title, badge: def.badge, places };
}

const minigameList = Minigames.filter(game => game.column !== 'tithe_farm');
const minigameColumns = minigameList.map(game => game.column);

const COLLECTOR_CLS = ['skilling', 'clues', 'minigames', 'other', 'overall'] as const;

/** Same giveaway channels the weekly role refresh uses. */
const GIVEAWAY_CHANNELS = [
	'792691343284764693',
	'732207379818479756',
	'342983479501389826',
	'982989775399174184',
	'346304390858145792'
];

function formatCount(value: number): string {
	return value.toLocaleString('en-US');
}

async function fetchSkillerOfTheWeek(limit: number) {
	// There is no weekly XP contest in code. Show current SotW trophy holders.
	const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
		`SELECT id FROM users WHERE badges @> ARRAY[${BadgesEnum.SotWTrophy}]::int[] LIMIT ${limit};`
	);
	return nPlaces(
		rows.map(r => ({ id: r.id, reason: 'SotW trophy' })),
		limit
	);
}

async function rankSkillersByTotalLevel() {
	const top200TotalXPUsers = await prisma.$queryRawUnsafe<
		({ id: string; totalxp: bigint } & Record<`skills.${SkillNameType}`, bigint>)[]
	>(
		`SELECT id, ${SkillsArray.map(s => `"skills.${s}"`)}, ${SkillsArray.map(s => `"skills.${s}"::bigint`).join(
			' + '
		)} as totalxp FROM users ORDER BY totalxp DESC LIMIT 200;`
	);

	return top200TotalXPUsers
		.map(u => {
			let totalLevel = 0;
			for (const skill of SkillsArray) {
				totalLevel += convertXPtoLVL(Number(u[`skills.${skill}`]), MAX_LEVEL);
			}
			return { id: u.id, totalLevel };
		})
		.sort((a, b) => b.totalLevel - a.totalLevel);
}

async function fetchSkiller(limit: number) {
	const ranked = await rankSkillersByTotalLevel();
	return nPlaces(
		ranked.map(u => ({ id: u.id, reason: `Total level ${formatCount(u.totalLevel)}` })),
		limit
	);
}

async function fetchSkillerSkillLeaders(): Promise<TopRoleCategoryEntry[]> {
	const topPerSkill = await prisma.$transaction(
		SkillsArray.map(skill =>
			prisma.$queryRawUnsafe<{ id: string; skill: string }[]>(
				`SELECT id, '${skill}' AS skill FROM users ORDER BY "skills.${skill}" DESC LIMIT 1;`
			)
		)
	);
	return topPerSkill.flat().map(row => ({
		label: toTitleCase(row.skill),
		userID: row.id
	}));
}

async function fetchCollector(limit: number) {
	const items = getCollectionItems('overall');
	const result = await fetchCLLeaderboard({
		ironmenOnly: false,
		items,
		resultLimit: limit,
		clName: 'overall'
	});
	const users = result?.users ?? [];
	return nPlaces(
		users.map(u => ({
			id: u.id,
			reason: `${formatCount(u.qty)} overall`
		})),
		limit
	);
}

async function fetchCollectorCategoryLeaders(): Promise<TopRoleCategoryEntry[]> {
	const boards = await fetchMultipleCLLeaderboards(
		COLLECTOR_CLS.flatMap(cl => {
			const items = getCollectionItems(cl);
			const limit = cl === 'overall' ? 3 : 1;
			return [
				{ items, clName: cl, resultLimit: limit, ironmenOnly: false },
				{ items, clName: cl, resultLimit: 1, ironmenOnly: true }
			];
		})
	);
	const entries: TopRoleCategoryEntry[] = [];
	for (const board of boards) {
		const kind = board.ironmenOnly ? 'Iron' : 'Main';
		for (const [index, user] of board.users.entries()) {
			const rank = board.clName === 'overall' ? `top ${index + 1} ` : 'rank 1 ';
			entries.push({
				label: `${rank}${kind} ${board.clName}`,
				userID: user.id
			});
		}
	}
	return entries;
}

async function fetchSacrificer(limit: number) {
	const rows = await prisma.$queryRawUnsafe<{ id: string; value: bigint }[]>(
		`SELECT id, "sacrificedValue" AS value FROM users ORDER BY "sacrificedValue" DESC LIMIT ${limit};`
	);
	return nPlaces(
		rows.filter(r => r.value > 0n).map(r => ({ id: r.id, reason: formatCount(Number(r.value)) })),
		limit
	);
}

async function fetchSacrificerCategoryLeaders(): Promise<TopRoleCategoryEntry[]> {
	const users = await prisma.$transaction([
		prisma.$queryRawUnsafe<{ id: string; reason: string }[]>(
			`SELECT id, 'Top ironman value' AS reason FROM users WHERE "minion.ironman" = true ORDER BY "sacrificedValue" DESC LIMIT 1;`
		),
		prisma.$queryRawUnsafe<{ id: string; reason: string }[]>(`SELECT u.id, 'Most uniques' AS reason FROM (
  SELECT (SELECT COUNT(*)::int FROM JSONB_OBJECT_KEYS("sacrificed_bank")) sacbanklength, user_id::text as id FROM user_stats
) u
ORDER BY u.sacbanklength DESC LIMIT 1;`),
		prisma.$queryRawUnsafe<{ id: string; reason: string }[]>(`SELECT u.id, 'Most ironman uniques' AS reason FROM (
  SELECT (SELECT COUNT(*)::int FROM JSONB_OBJECT_KEYS("sacrificed_bank")) sacbanklength, user_id::text as id FROM user_stats
  INNER JOIN users ON "user_stats"."user_id"::text = "users"."id"
  WHERE "users"."minion.ironman" = true
) u
ORDER BY u.sacbanklength DESC LIMIT 1;`)
	]);
	return users.flat().map(row => ({ label: row.reason, userID: row.id }));
}

async function fetchSlayer(limit: number) {
	const rows = await prisma.$queryRawUnsafe<{ id: string; points: number }[]>(
		`SELECT id, "slayer.points" AS points FROM users WHERE "slayer.points" > 50 ORDER BY "slayer.points" DESC LIMIT ${limit};`
	);
	return nPlaces(
		rows.map(r => ({ id: r.id, reason: `${formatCount(Number(r.points))} points` })),
		limit
	);
}

async function fetchSlayerCategoryLeaders(): Promise<TopRoleCategoryEntry[]> {
	const topSlayers = await prisma.$transaction([
		prisma.$queryRawUnsafe<{ id: string; reason: string }[]>(
			`SELECT user_id::text as id, 'Longest task streak' as reason
FROM user_stats
WHERE "slayer_task_streak" > 20
ORDER BY "slayer_task_streak" DESC
LIMIT 1;`
		),
		prisma.$queryRawUnsafe<{ id: string; reason: string }[]>(
			`SELECT user_id::text as id, 'Most tasks' as reason
FROM slayer_tasks
GROUP BY user_id
ORDER BY count(user_id)::int DESC
LIMIT 1;`
		)
	]);
	return topSlayers.flat().map(row => ({ label: row.reason, userID: row.id }));
}

async function fetchClueHunter(limit: number) {
	const sumExpr = ClueTiers.map(t => `COALESCE((openable_scores->>'${t.id}')::int, 0)`).join(' + ');
	const rows = await prisma.$queryRawUnsafe<{ id: string; qty: number }[]>(
		`SELECT user_id::text AS id, (${sumExpr}) AS qty
FROM user_stats
ORDER BY qty DESC
LIMIT ${limit};`
	);
	return nPlaces(
		rows.filter(r => r.qty > 0).map(r => ({ id: r.id, reason: `${formatCount(r.qty)} clues` })),
		limit
	);
}

async function fetchClueHunterTierLeaders(): Promise<TopRoleCategoryEntry[]> {
	const topClueHunters = await prisma.$transaction(
		ClueTiers.map(t =>
			prisma.$queryRawUnsafe<{ user_id: string; tier_name: string }[]>(
				`SELECT user_id::text, '${t.name}' AS tier_name, (openable_scores->>'${t.id}')::int AS qty
FROM user_stats
WHERE "openable_scores"->>'${t.id}' IS NOT NULL
ORDER BY qty DESC
LIMIT 1;`
			)
		)
	);
	return topClueHunters.flat().map(row => ({
		label: row.tier_name,
		userID: row.user_id
	}));
}

async function fetchMinigamer(limit: number) {
	if (minigameColumns.length === 0) return nPlaces([], limit);
	const sumExpr = minigameColumns.map(col => `"${col}"`).join(' + ');
	const rows = await prisma.$queryRawUnsafe<{ id: string; qty: number }[]>(
		`SELECT user_id::text AS id, (${sumExpr}) AS qty
FROM minigames
ORDER BY qty DESC
LIMIT ${limit};`
	);
	return nPlaces(
		rows.filter(r => r.qty > 0).map(r => ({ id: r.id, reason: `${formatCount(r.qty)} total score` })),
		limit
	);
}

async function fetchMinigamerCategoryLeaders(): Promise<TopRoleCategoryEntry[]> {
	if (minigameList.length === 0) return [];
	const topMinigamers = await prisma.$transaction(
		minigameList.map(game =>
			prisma.$queryRawUnsafe<{ id: string; minigame_name: string }[]>(
				`SELECT user_id::text AS id, '${game.column}' AS minigame_name
FROM minigames
WHERE "${game.column}" > 0
ORDER BY "${game.column}" DESC
LIMIT 1;`
			)
		)
	);
	const byColumn = new Map<string, string>(minigameList.map(game => [game.column, game.name]));
	return topMinigamers.flat().map(row => ({
		label: byColumn.get(row.minigame_name) ?? toTitleCase(row.minigame_name.replaceAll('_', ' ')),
		userID: row.id
	}));
}

async function fetchFarmer(limit: number) {
	const rows = await prisma.$queryRawUnsafe<{ id: string; qty: number }[]>(
		`SELECT id, ("minion.farmingContract"->>'contractsCompleted')::int AS qty
FROM users
WHERE "minion.farmingContract" IS NOT NULL
AND ("minion.farmingContract"->>'contractsCompleted')::int > 0
ORDER BY qty DESC
LIMIT ${limit};`
	);
	return nPlaces(
		rows.map(r => ({ id: r.id, reason: `${formatCount(r.qty)} contracts` })),
		limit
	);
}

async function fetchFarmerCategoryLeaders(): Promise<TopRoleCategoryEntry[]> {
	const queries = [
		`SELECT id, 'Most ironman contracts' as reason
FROM users
WHERE "minion.farmingContract" IS NOT NULL
AND "minion.ironman" = true
AND ("minion.farmingContract"->>'contractsCompleted')::int > 0
ORDER BY ("minion.farmingContract"->>'contractsCompleted')::int DESC
LIMIT 1;`,
		`SELECT user_id::text as id, 'Most farming trips' as reason
FROM activity
WHERE type = 'Farming'
GROUP BY user_id
ORDER BY count(user_id)::int DESC
LIMIT 1;`,
		`SELECT user_id::text as id, 'Most Tithe Farm' as reason
FROM user_stats
WHERE "tithe_farms_completed" > 0
ORDER BY "tithe_farms_completed" DESC
LIMIT 1;`
	];
	const res = await prisma.$transaction(
		queries.map(q => prisma.$queryRawUnsafe<{ id: string; reason: string }[]>(q))
	);
	return res.flat().map(row => ({ label: row.reason, userID: row.id }));
}

async function fetchGiveawayer(limit: number) {
	const res = await prisma.$queryRaw<{ user_id: string; qty: number }[]>`SELECT user_id, COUNT(user_id)::int AS qty
	FROM giveaway
	WHERE channel_id IN (${Prisma.join(GIVEAWAY_CHANNELS)})
	AND user_id NOT IN ('157797566833098752')
	GROUP BY user_id
	ORDER BY qty DESC
	LIMIT 50;`;
	const userIDsToCheck = res.map(i => i.user_id);
	if (userIDsToCheck.length === 0) return nPlaces([], limit);

	const giveawayBank = new TeamLoot();
	const giveaways = await prisma.giveaway.findMany({
		where: {
			channel_id: { in: GIVEAWAY_CHANNELS },
			user_id: { in: userIDsToCheck }
		}
	});
	if (giveaways.length === 0) return nPlaces([], limit);

	for (const giveaway of giveaways) {
		giveawayBank.add(giveaway.user_id, giveaway.loot as ItemBank);
	}

	const ranked = giveawayBank
		.entries()
		.sort((a, b) => b[1].value() - a[1].value())
		.map(([id, loot]) => ({ id, reason: formatCount(loot.value()) }));
	return nPlaces(ranked, limit);
}

/** Read-only standings. Does not assign Discord roles or badges. */
export async function fetchTopRoleStandings(): Promise<TopRoleStanding[]> {
	const defs = Object.fromEntries(TOP_ROLE_TITLES.map(d => [d.key, d])) as Record<
		TopRoleKey,
		(typeof TOP_ROLE_TITLES)[number]
	>;
	const [sotw, collector, sacrificer, skiller, slayer, clue, minigamer, farmer, giveawayer] = await Promise.all([
		fetchSkillerOfTheWeek(OVERVIEW_PLACES),
		fetchCollector(OVERVIEW_PLACES),
		fetchSacrificer(OVERVIEW_PLACES),
		fetchSkiller(OVERVIEW_PLACES),
		fetchSlayer(OVERVIEW_PLACES),
		fetchClueHunter(OVERVIEW_PLACES),
		fetchMinigamer(OVERVIEW_PLACES),
		fetchFarmer(OVERVIEW_PLACES),
		fetchGiveawayer(OVERVIEW_PLACES)
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

export async function fetchTopRoleBreakdown(key: TopRoleKey): Promise<TopRoleBreakdown> {
	const def = roleDef(key);
	switch (key) {
		case 'sotw':
			return {
				...def,
				scoring:
					'Shows who currently holds the Skiller of the Week trophy. There is no weekly XP contest in this command.',
				overallTitle: 'Trophy holders',
				overall: await fetchSkillerOfTheWeek(BREAKDOWN_PLACES)
			};
		case 'collector':
			return {
				...def,
				scoring:
					'The weekly role goes to the top overall collection logs and rank 1 in the skilling, clues, minigames, and other logs (main and iron).',
				overallTitle: 'Top 5 (overall collection log)',
				overall: await fetchCollector(BREAKDOWN_PLACES),
				categoryHeading: 'Weekly role winners',
				categories: await fetchCollectorCategoryLeaders()
			};
		case 'sacrificer':
			return {
				...def,
				scoring:
					'The weekly role goes to the top sacrificed value, top ironman value, and the most unique items sacrificed.',
				overallTitle: 'Top 5 (value sacrificed)',
				overall: await fetchSacrificer(BREAKDOWN_PLACES),
				categoryHeading: 'Weekly role winners',
				categories: await fetchSacrificerCategoryLeaders()
			};
		case 'skiller':
			return {
				...def,
				scoring: 'The weekly role goes to rank 1 total level and rank 1 XP in each skill.',
				overallTitle: 'Top 5 (total level)',
				overall: await fetchSkiller(BREAKDOWN_PLACES),
				categoryHeading: 'Rank 1 XP',
				categories: await fetchSkillerSkillLeaders()
			};
		case 'slayer':
			return {
				...def,
				scoring: 'The weekly role goes to the most slayer points, the longest task streak, and the most tasks.',
				overallTitle: 'Top 5 (slayer points)',
				overall: await fetchSlayer(BREAKDOWN_PLACES),
				categoryHeading: 'Weekly role winners',
				categories: await fetchSlayerCategoryLeaders()
			};
		case 'clue_hunter':
			return {
				...def,
				scoring:
					'The weekly role goes to rank 1 opens in each clue tier. This list also ranks by total clues opened.',
				overallTitle: 'Top 5 (clues opened)',
				overall: await fetchClueHunter(BREAKDOWN_PLACES),
				categoryHeading: 'Rank 1 by tier',
				categories: await fetchClueHunterTierLeaders()
			};
		case 'minigamer':
			return {
				...def,
				scoring:
					'The weekly role goes to rank 1 in each minigame (Tithe Farm is counted with Farmer). This list also ranks by total minigame score.',
				overallTitle: 'Top 5 (total minigame score)',
				overall: await fetchMinigamer(BREAKDOWN_PLACES),
				categoryHeading: 'Rank 1 by minigame',
				categories: await fetchMinigamerCategoryLeaders()
			};
		case 'farmer':
			return {
				...def,
				scoring:
					'The weekly role goes to the most farming contracts, farming trips, and Tithe Farm completions.',
				overallTitle: 'Top 5 (farming contracts)',
				overall: await fetchFarmer(BREAKDOWN_PLACES),
				categoryHeading: 'Weekly role winners',
				categories: await fetchFarmerCategoryLeaders()
			};
		case 'giveawayer':
			return {
				...def,
				scoring: 'Ranked by the value of loot given away in the official giveaway channels.',
				overallTitle: 'Top 5 (value given away)',
				overall: await fetchGiveawayer(BREAKDOWN_PLACES)
			};
	}
}

export function safeDisplayName(name: string | null | undefined): string {
	const cleaned = (name ?? 'Unknown').replaceAll('@', '').replace(/\s+/g, ' ').trim() || 'Unknown';
	return cleaned.length > NAME_MAX ? cleaned.slice(0, NAME_MAX) : cleaned;
}

function placeLabel(index: number): string {
	if (index === 1) return '2nd';
	if (index === 2) return '3rd';
	return `${index + 1}th`;
}

/**
 * Short, no-ping listing of each Top role's current top 3.
 * Uses badge emojis from badgeEmojis.ts only. Names are plain text (no mentions).
 */
export function formatTopRoleStandings(standings: TopRoleStanding[], names: Record<string, string>): string {
	const lines = ['**Top roles**'];
	for (const row of standings) {
		const badge = badgeEmoji(row.badge);
		const badgePrefix = badge ? `${badge} ` : '';
		if (row.places.length === 0) {
			lines.push(`${badgePrefix}**${row.title}:** None yet`);
			continue;
		}
		const bits = row.places.map((place, index) => {
			const name = safeDisplayName(names[place.userID]);
			return index === 0 ? name : `${placeLabel(index)} ${name}`;
		});
		lines.push(`${badgePrefix}**${row.title}:** ${bits.join('  •  ')}`);
	}
	return lines.join('\n');
}

function formatOverallLines(overall: TopRolePlace[], names: Record<string, string>): string[] {
	if (overall.length === 0) return ['None yet'];
	return overall.map((place, index) => {
		const name = safeDisplayName(names[place.userID]);
		return place.reason ? `${index + 1}. ${name} — ${place.reason}` : `${index + 1}. ${name}`;
	});
}

function groupCategories(entries: TopRoleCategoryEntry[]): { userID: string; labels: string[] }[] {
	const grouped: { userID: string; labels: string[] }[] = [];
	const indexByUser = new Map<string, number>();
	for (const entry of entries) {
		if (!entry.userID) continue;
		const existing = indexByUser.get(entry.userID);
		if (existing === undefined) {
			indexByUser.set(entry.userID, grouped.length);
			grouped.push({ userID: entry.userID, labels: [entry.label] });
		} else {
			grouped[existing].labels.push(entry.label);
		}
	}
	grouped.sort((a, b) => b.labels.length - a.labels.length);
	return grouped;
}

function formatGroupedCategoryLine(name: string, labels: string[], maxLen: number): string {
	const prefix = `${name} — `;
	const full = `${prefix}${labels.join(', ')}`;
	if (full.length <= maxLen) return full;
	const budget = maxLen - prefix.length - 1;
	if (budget <= 8) return `${name} — …`;
	const kept: string[] = [];
	let used = 0;
	for (const label of labels) {
		const extra = kept.length === 0 ? label.length : label.length + 2;
		if (used + extra + 5 > budget) break;
		kept.push(label);
		used += extra;
	}
	if (kept.length === 0) {
		const first = labels[0] ?? '';
		return `${prefix}${first.slice(0, Math.max(1, budget - 1))}…`;
	}
	return `${prefix}${kept.join(', ')}…`;
}

export function formatCategoryLines(
	entries: TopRoleCategoryEntry[],
	names: Record<string, string>,
	budget: number
): string[] {
	if (entries.length === 0) return ['None yet'];
	const grouped = groupCategories(entries);
	const lines: string[] = [];
	let remaining = grouped.length;
	for (const group of grouped) {
		const name = safeDisplayName(names[group.userID]);
		const line = formatGroupedCategoryLine(name, group.labels, 90);
		const leftover = remaining - 1;
		const moreLine = leftover > 0 ? `…and ${leftover} more` : '';
		const used = lines.reduce((sum, item) => sum + item.length + 1, 0);
		if (used + line.length + 1 + moreLine.length > budget) {
			if (moreLine) lines.push(`…and ${remaining} more`);
			break;
		}
		lines.push(line);
		remaining -= 1;
	}
	return lines.length > 0 ? lines : ['…'];
}

/**
 * One-role breakdown: scoring, top 5, and category leaders where they exist.
 * Always stays at least 150 characters under Discord's 2,000 character limit.
 */
export function formatTopRoleBreakdown(breakdown: TopRoleBreakdown, names: Record<string, string>): string {
	const badge = badgeEmoji(breakdown.badge);
	const badgePrefix = badge ? `${badge} ` : '';
	const header = [`${badgePrefix}**${breakdown.title}**`, breakdown.scoring, '', `**${breakdown.overallTitle}**`];
	const overallLines = formatOverallLines(breakdown.overall, names);
	const core = [...header, ...overallLines].join('\n');

	if (!breakdown.categoryHeading || !breakdown.categories) {
		return core.length <= DISCORD_CONTENT_SAFE ? core : core.slice(0, DISCORD_CONTENT_SAFE - 1);
	}

	const prefix = `${core}\n\n**${breakdown.categoryHeading}**\n`;
	const budget = DISCORD_CONTENT_SAFE - prefix.length;
	if (budget < 8) return core.slice(0, DISCORD_CONTENT_SAFE);
	const categoryLines = formatCategoryLines(breakdown.categories, names, budget);
	return `${prefix}${categoryLines.join('\n')}`;
}

export function collectStandingUserIDs(standings: TopRoleStanding[]): string[] {
	return [...new Set(standings.flatMap(row => row.places.map(place => place.userID)))];
}

export function collectBreakdownUserIDs(breakdown: TopRoleBreakdown): string[] {
	const ids = breakdown.overall.map(place => place.userID);
	for (const entry of breakdown.categories ?? []) ids.push(entry.userID);
	return [...new Set(ids.filter(Boolean))];
}
