import { Emoji } from '@oldschoolgg/toolkit';

/**
 * Weekly recap: pure helpers (schedule maths and text). No DB or Discord, so they are easy to test.
 * Data loading and posting live in ./weeklyRecap.ts.
 */

export const RECAP_TIME_ZONE = 'America/Chicago';
/** Sunday, 12:00 PM Central (DST-aware). */
export const RECAP_WEEKDAY = 0;
export const RECAP_HOUR = 12;
/** If the bot was down at noon, still post within this long after; later than that the week is skipped. */
export const RECAP_CATCH_UP_MS = 3 * 60 * 60 * 1000;
export const RECAP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const XP_FOR_99 = 13_034_431;
export const DISCORD_MAX_CHARS = 2000;

/** Pages called out by name when they were finished this week (if not already in the top list). */
export const NOTABLE_CL_PAGES = [
	'The Inferno',
	'The Fight Caves',
	'Fortis Colosseum',
	'Theatre of Blood',
	'Tombs of Amascut',
	'Chambers of Xeric',
	'Nex',
	'The Corrupted Gauntlet',
	'The Nightmare'
];

function zoneParts(ms: number, timeZone = RECAP_TIME_ZONE) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		weekday: 'short'
	}).formatToParts(new Date(ms));
	const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')),
		minute: Number(get('minute')),
		second: Number(get('second')),
		weekday: weekdays.indexOf(get('weekday'))
	};
}

/** UTC ms for a wall-clock time in the zone (handles CST/CDT). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timeZone = RECAP_TIME_ZONE) {
	const guess = Date.UTC(year, month - 1, day, hour);
	let result = guess;
	for (let i = 0; i < 2; i++) {
		const p = zoneParts(result, timeZone);
		const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
		result += guess - asIfUtc;
	}
	return result;
}

/** The latest scheduled recap time (Sunday 12:00 PM Central) at or before `now`. */
export function latestRecapSlot(now: number): number {
	const p = zoneParts(now);
	const daysBack = (p.weekday - RECAP_WEEKDAY + 7) % 7;
	const base = new Date(Date.UTC(p.year, p.month - 1, p.day - daysBack));
	let slot = zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), RECAP_HOUR);
	if (slot > now) {
		const prev = new Date(Date.UTC(p.year, p.month - 1, p.day - daysBack - 7));
		slot = zonedTimeToUtc(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), RECAP_HOUR);
	}
	return slot;
}

/** The slot to post now, or null (already past the catch-up window). */
export function dueRecapSlot(now: number): number | null {
	const slot = latestRecapSlot(now);
	return now - slot <= RECAP_CATCH_UP_MS ? slot : null;
}

export function recapKey(slot: number): string {
	return new Date(slot).toISOString();
}

export function formatRecapRange(startMs: number, endMs: number): string {
	const day = (ms: number) =>
		new Intl.DateTimeFormat('en-US', {
			timeZone: RECAP_TIME_ZONE,
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		}).format(ms);
	const time = (ms: number) =>
		new Intl.DateTimeFormat('en-US', { timeZone: RECAP_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(ms);
	const year = zoneParts(endMs).year;
	return `${day(startMs)}, ${time(startMs)} – ${day(endMs)}, ${time(endMs)} CT, ${year}`;
}

export function fmtNum(n: number): string {
	return Math.round(n).toLocaleString('en-US');
}

export function fmtXP(n: number): string {
	if (n >= 1_000_000_000) return `${(Math.floor(n / 100_000_000) / 10).toFixed(1)}b`;
	if (n >= 1_000_000) return `${(Math.floor(n / 100_000) / 10).toFixed(1)}m`;
	if (n >= 1000) return `${(Math.floor(n / 100) / 10).toFixed(1)}k`;
	return fmtNum(n);
}

export function joinList(items: string[]): string {
	if (items.length <= 1) return items[0] ?? '';
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export const tag = (userID: string) => `<@${userID}>`;

export interface RecapData {
	startMs: number;
	endMs: number;
	trips: number;
	hours: number;
	players: number;
	trades: number;
	topSkill: { skill: string; xp: number } | null;
	bosses: { name: string; kc: number }[];
	bossHunters: { userID: string; kc: number }[];
	skillers: { userID: string; xp: number }[];
	new120s: { userID: string; skill: string }[];
	new99s: { userID: string; skill: string }[];
	clCompletions: { userID: string; page: string }[];
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ranked<T>(rows: T[], line: (row: T) => string, limit: number): string {
	return rows
		.slice(0, limit)
		.map((r, i) => `${i + 1}. ${line(r)}`)
		.join('\n');
}

/** Groups pages by how often they were finished: "Skilling Pets (15), Obor and Barrows Chests (4 each)". */
export function topPagesLine(pages: string[], groups = 3): string {
	const counts = new Map<string, number>();
	for (const p of pages) counts.set(p, (counts.get(p) ?? 0) + 1);
	const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	const byCount = new Map<number, string[]>();
	for (const [page, n] of sorted) {
		if (!byCount.has(n) && byCount.size >= groups) break;
		const list = byCount.get(n) ?? [];
		if (list.length < 3) list.push(page);
		byCount.set(n, list);
	}
	return [...byCount.entries()]
		.map(([n, names]) => (names.length > 1 ? `${joinList(names)} (${n} each)` : `${names[0]} (${n})`))
		.join(', ');
}

function shownPages(line: string, pages: string[]): Set<string> {
	return new Set(pages.filter(p => line.includes(p)));
}

/**
 * Builds the recap text and the exact list of players it tags. `limit` shrinks the top lists if the post would go
 * over Discord's 2000 character limit.
 */
export function buildRecap(data: RecapData, limit = 5): { content: string; userIDs: string[] } {
	const sections: string[] = [];
	const tagged = new Set<string>();
	const t = (id: string) => {
		tagged.add(id);
		return tag(id);
	};

	sections.push(
		`${Emoji.EsbCorgi} **Bark School Corgo — Weekly Recap**\n${formatRecapRange(data.startMs, data.endMs)}`
	);

	if (data.trips > 0 || data.trades > 0) {
		const second = [`${fmtNum(data.trades)} player trades`];
		if (data.topSkill) second.push(`most XP: ${titleCase(data.topSkill.skill)} (${fmtXP(data.topSkill.xp)})`);
		sections.push(
			`${Emoji.Bank} **The week in numbers**\n${fmtNum(data.trips)} trips • ${fmtNum(data.hours)} hours • ${fmtNum(data.players)} players\n${second.join(' • ')}`
		);
	}
	if (data.bosses.length > 0) {
		sections.push(
			`${Emoji.CombatSword} **Most hunted bosses**\n${ranked(data.bosses, b => `${b.name} — ${fmtNum(b.kc)} KC`, limit)}`
		);
	}
	if (data.bossHunters.length > 0) {
		sections.push(
			`${Emoji.DragonTrophy} **Top boss hunters**\n${ranked(data.bossHunters, b => `${t(b.userID)} — ${fmtNum(b.kc)} KC`, limit)}`
		);
	}
	if (data.skillers.length > 0) {
		sections.push(
			`${Emoji.XP} **Top skillers**\n${ranked(data.skillers, s => `${t(s.userID)} — ${fmtXP(s.xp)} XP`, limit)}`
		);
	}

	const levelLines: string[] = [];
	if (data.new120s.length > 0) {
		const bySkill = new Map<string, string[]>();
		for (const { userID, skill } of data.new120s) {
			const list = bySkill.get(skill) ?? [];
			if (!list.includes(userID)) list.push(userID);
			bySkill.set(skill, list);
		}
		const parts = [...bySkill.entries()]
			.slice(0, limit)
			.map(([skill, ids]) => `${joinList(ids.slice(0, limit).map(t))} (${titleCase(skill)})`);
		levelLines.push(`New 120s: ${parts.join(', ')}`);
	}
	if (data.new99s.length > 0) {
		const perUser = new Map<string, number>();
		for (const { userID } of data.new99s) perUser.set(userID, (perUser.get(userID) ?? 0) + 1);
		const players = perUser.size;
		levelLines.push(
			`${fmtNum(players)} ${players === 1 ? 'player' : 'players'} reached a new 99, for ${fmtNum(data.new99s.length)} new ${data.new99s.length === 1 ? '99' : '99s'} in all.`
		);
		const top = [...perUser.entries()]
			.filter(([, n]) => n > 1)
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, 3);
		if (top.length > 0) levelLines.push(`Most 99s: ${top.map(([id, n]) => `${t(id)} (${n})`).join(', ')}.`);
	}
	if (levelLines.length > 0) sections.push(`${Emoji.Skiller} **New 99s and 120s**\n${levelLines.join('\n')}`);

	if (data.clCompletions.length > 0) {
		const pages = data.clCompletions.map(c => c.page);
		const players = new Set(data.clCompletions.map(c => c.userID)).size;
		const lines = [
			`${fmtNum(players)} ${players === 1 ? 'player' : 'players'} finished ${fmtNum(pages.length)} ${pages.length === 1 ? 'page' : 'pages'}.`
		];
		const top = topPagesLine(pages);
		lines.push(`Most completed: ${top}.`);
		const shown = shownPages(top, pages);
		const notable = NOTABLE_CL_PAGES.filter(p => pages.includes(p) && !shown.has(p));
		if (notable.length > 0) {
			lines.push(`${joinList(notable)} ${notable.length === 1 ? 'was' : 'were'} also finished this week.`);
		}
		sections.push(`${Emoji.CollectionLog} **Collection logs**\n${lines.join('\n')}`);
	}

	const content = sections.join('\n\n');
	if (content.length > DISCORD_MAX_CHARS && limit > 1) return buildRecap(data, limit - 1);
	return {
		content: content.length > DISCORD_MAX_CHARS ? `${content.slice(0, DISCORD_MAX_CHARS - 1)}…` : content,
		userIDs: [...tagged]
	};
}
