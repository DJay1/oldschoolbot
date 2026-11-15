import {
	buildRecap,
	dueRecapSlot,
	RECAP_WINDOW_MS,
	type RecapData,
	recapKey,
	XP_FOR_99
} from '@/lib/bsc/weeklyRecapFormat.js';
import { Channel } from '@/lib/constants.js';
import { allCollectionLogs } from '@/lib/data/Collections.js';
import { effectiveMonsters } from '@/lib/minions/data/killableMonsters/index.js';

/**
 * Weekly recap: posted every Sunday at 12:00 PM Central to the rare drop channel, covering the 7 days before.
 * Read-only queries; the only write is the once-per-week claim row (kind 'weekly_recap' in bsc_server_firsts,
 * PRIMARY KEY kind + key, INSERT ... ON CONFLICT DO NOTHING). Tags exactly the players it names, nobody else.
 */

const KIND = 'weekly_recap';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function kcNames(kc: unknown): string[] {
	if (typeof kc === 'string') return [kc];
	if (Array.isArray(kc)) return kc.flatMap(kcNames);
	if (kc && typeof kc === 'object') return Object.values(kc).flatMap(kcNames);
	return [];
}

/**
 * Boss = a monster that is the KC source of a collection log page (e.g. Dagannoth Prime for "Dagannoth Kings"),
 * or whose name is a PvM page name (plain, plural, or "<name> Chests" like Barrows).
 */
/** Counted as bosses even without their own PvM page (they were in the approved sample). */
const EXTRA_BOSSES = ['Lizardman Shaman'];
/** PvM pages that are not bosses. */
const NOT_BOSSES = ['Chaos druid', 'TzHaar-Ket', 'TzHaar-Xil', 'TzHaar-Mej'];

const bossNameSet = new Set<string>(EXTRA_BOSSES.map(norm));
for (const activity of Object.values(allCollectionLogs.PvM.activities)) {
	for (const name of kcNames((activity as { kcActivity?: unknown }).kcActivity)) bossNameSet.add(norm(name));
}
for (const page of Object.keys(allCollectionLogs.PvM.activities)) {
	const n = norm(page);
	bossNameSet.add(n);
	if (n.endsWith('s')) bossNameSet.add(n.slice(0, -1));
	if (n.endsWith('chests')) bossNameSet.add(n.slice(0, -'chests'.length));
}

export const recapBossNames: ReadonlyMap<number, string> = new Map(
	effectiveMonsters
		.filter(m => bossNameSet.has(norm(m.name)) && !NOT_BOSSES.map(norm).includes(norm(m.name)))
		.map(m => [m.id, m.name])
);

async function ensureTable() {
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_server_firsts (
			kind text NOT NULL,
			key text NOT NULL,
			user_ids text[] NOT NULL DEFAULT '{}',
			seeded boolean NOT NULL DEFAULT false,
			claimed_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (kind, key)
		)
	`);
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

let skillColumns: Promise<string[]> | null = null;
function getSkillColumns(): Promise<string[]> {
	skillColumns ??= prisma
		.$queryRawUnsafe<{ skill: string }[]>(`
			SELECT e.skill FROM unnest(enum_range(NULL::xp_gains_skill_enum)::text[]) AS e(skill)
			WHERE EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'users' AND column_name = 'skills.' || e.skill
			)`)
		.then(rows => rows.map(r => r.skill).filter(s => /^[a-z_]+$/.test(s)));
	return skillColumns;
}

const pageNames = new Map<string, string>();
for (const category of Object.values(allCollectionLogs)) {
	for (const page of Object.keys(category.activities)) pageNames.set(norm(page), page);
}

/** Collection log completions with the page's real name, one per player per page. */
function clCompletions(rows: Row[]) {
	const seen = new Set<string>();
	const out: { userID: string; page: string }[] = [];
	for (const r of rows) {
		if (r.type !== 'CLCompletion' || !r.page) continue;
		const page = pageNames.get(norm(String(r.page))) ?? String(r.page);
		const key = `${r.id}:${page}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ userID: String(r.id), page });
	}
	return out;
}

export async function loadRecapData(startMs: number, endMs: number): Promise<RecapData> {
	const s = new Date(startMs).toISOString();
	const e = new Date(endMs).toISOString();
	const q = <T = Row>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql, s, e);

	const [trips] = await q(`
		SELECT COUNT(*)::int AS trips, COALESCE(SUM(duration), 0)::float8 AS ms, COUNT(DISTINCT user_id)::int AS players
		FROM activity WHERE completed = true AND finish_date >= $1::timestamp AND finish_date < $2::timestamp`);
	const [trades] = await q(`
		SELECT COUNT(*)::int AS n FROM economy_transaction
		WHERE type = 'trade' AND date >= $1::timestamp AND date < $2::timestamp`);
	const skills = await q(`
		SELECT skill::text AS skill, SUM(xp)::float8 AS xp FROM xp_gains
		WHERE date >= $1::timestamp AND date < $2::timestamp AND COALESCE(artificial, false) = false
		GROUP BY skill ORDER BY xp DESC LIMIT 1`);
	const skillers = await q(`
		SELECT user_id::text AS id, SUM(xp)::float8 AS xp FROM xp_gains
		WHERE date >= $1::timestamp AND date < $2::timestamp AND COALESCE(artificial, false) = false
		GROUP BY user_id ORDER BY xp DESC, user_id LIMIT 5`);

	// Boss KC: monster trips by monster id, plus Nex and Chambers of Xeric. Every player in a group trip gets the kills.
	const kills = await q(`
		SELECT a.type::text AS type, a.data->>'mi' AS mi, u.uid::text AS id,
			SUM(COALESCE((a.data->>'q')::int, (a.data->>'quantity')::int, 1))::float8 AS kc
		FROM activity a
		CROSS JOIN LATERAL unnest(
			CASE WHEN cardinality(a.all_user_ids) > 0 THEN a.all_user_ids ELSE ARRAY[a.user_id] END
		) AS u(uid)
		WHERE a.completed = true AND a.finish_date >= $1::timestamp AND a.finish_date < $2::timestamp
		AND a.type IN ('MonsterKilling', 'GroupMonsterKilling', 'Nex', 'Raids')
		GROUP BY 1, 2, 3`);
	const bossTotals = new Map<string, number>();
	const hunterTotals = new Map<string, number>();
	for (const k of kills) {
		let name: string | undefined;
		if (k.type === 'Nex') name = 'Nex';
		else if (k.type === 'Raids') name = 'Chambers of Xeric';
		else name = recapBossNames.get(Number(k.mi));
		if (!name) continue;
		bossTotals.set(name, (bossTotals.get(name) ?? 0) + num(k.kc));
		hunterTotals.set(String(k.id), (hunterTotals.get(String(k.id)) ?? 0) + num(k.kc));
	}
	const top = <K>(m: Map<K, number>) =>
		[...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, 5);

	const levelEvents = await q(`
		SELECT user_id AS id, type::text AS type, skill::text AS skill, collection_log_name AS page FROM user_event
		WHERE date >= $1::timestamp AND date < $2::timestamp AND type IN ('MaxLevel', 'CLCompletion')
		ORDER BY date`);

	// New 99s: current XP is at least 99 and was below it before this week's gains.
	const cols = await getSkillColumns();
	let new99s: Row[] = [];
	if (cols.length > 0) {
		const current = cols.map(c => `WHEN '${c}' THEN u."skills.${c}"`).join(' ');
		new99s = await q(`
			WITH g AS (
				SELECT user_id, skill::text AS skill, SUM(xp)::bigint AS gained FROM xp_gains
				WHERE date >= $1::timestamp AND date < $2::timestamp GROUP BY user_id, skill
			)
			SELECT g.user_id::text AS id, g.skill FROM g
			JOIN users u ON u.id = g.user_id::text
			CROSS JOIN LATERAL (SELECT (CASE g.skill ${current} END)::bigint AS xp) AS c
			WHERE c.xp >= ${XP_FOR_99} AND c.xp - g.gained < ${XP_FOR_99}`);
	}

	return {
		startMs,
		endMs,
		trips: num(trips?.trips),
		hours: num(trips?.ms) / 3_600_000,
		players: num(trips?.players),
		trades: num(trades?.n),
		topSkill: skills[0] ? { skill: String(skills[0].skill), xp: num(skills[0].xp) } : null,
		bosses: top(bossTotals).map(([name, kc]) => ({ name, kc })),
		bossHunters: top(hunterTotals).map(([userID, kc]) => ({ userID, kc })),
		skillers: skillers.map(r => ({ userID: String(r.id), xp: num(r.xp) })),
		new120s: levelEvents
			.filter(r => r.type === 'MaxLevel' && r.skill)
			.map(r => ({ userID: String(r.id), skill: String(r.skill) })),
		new99s: new99s.map(r => ({ userID: String(r.id), skill: String(r.skill) })),
		clCompletions: clCompletions(levelEvents)
	};
}

export async function sendRecap(startMs: number, endMs: number, { ping }: { ping: boolean }) {
	const { content, userIDs } = buildRecap(await loadRecapData(startMs, endMs));
	await globalClient.sendMessage(Channel.Notifications, {
		content,
		allowedMentions: { parse: [], roles: [], users: ping ? userIDs.slice(0, 100) : [] }
	});
	return content;
}

const running = { now: false };

/** Live bot ticker. Posts each Sunday's recap once; never throws. */
export async function weeklyRecapTick(now = Date.now()) {
	if (running.now) return;
	running.now = true;
	let claimedKey: string | null = null;
	try {
		const slot = dueRecapSlot(now);
		if (slot === null) return;
		await ensureTable();
		const key = recapKey(slot);
		const won = await prisma.$queryRaw<{ key: string }[]>`
			INSERT INTO bsc_server_firsts (kind, key, seeded) VALUES (${KIND}, ${key}, false)
			ON CONFLICT DO NOTHING RETURNING key
		`;
		if (won.length === 0) return;
		claimedKey = key;
		await sendRecap(slot - RECAP_WINDOW_MS, slot, { ping: true });
		claimedKey = null;
	} catch (err) {
		Logging.logError(err as Error);
	} finally {
		// Nothing was posted: release this week's claim so the next tick (still in the catch-up window) retries.
		if (claimedKey) {
			await prisma.$executeRaw`DELETE FROM bsc_server_firsts WHERE kind = ${KIND} AND key = ${claimedKey}`.catch(
				err => Logging.logError(err as Error)
			);
		}
		running.now = false;
	}
}
