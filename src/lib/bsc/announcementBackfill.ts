import { sleep } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import {
	announceRareAcquisition,
	DISCORD_EVENT_RARE_IDS,
	isCustomPetItem,
	isDiscordEventRareItem,
	type RareAnnounceKind,
	type RareAnnounceResult
} from '@/lib/bsc/rareAnnouncements.js';
import { customPetsCL } from '@/lib/bso/collection-log/main.js';

const ready = { done: false };

async function ensureBackfillStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_announcement_backfill (
			user_id text NOT NULL,
			item_id int NOT NULL,
			announced_at timestamptz NOT NULL DEFAULT NOW(),
			PRIMARY KEY (user_id, item_id)
		)
	`);
	ready.done = true;
}

export function backfillTargetItemIDs(): number[] {
	return [...new Set([...customPetsCL, ...DISCORD_EVENT_RARE_IDS])];
}

function kindFor(itemID: number): RareAnnounceKind | null {
	if (isCustomPetItem(itemID)) return 'custom_pet';
	if (isDiscordEventRareItem(itemID)) return 'discord_event_rare';
	return null;
}

export interface BackfillCandidate {
	userId: string;
	itemID: number;
	itemName: string;
	kind: RareAnnounceKind;
}

export interface BackfillRunOptions {
	/** When true, only list candidates - do not post or mark announced. */
	dryRun: boolean;
	/** Delay between real posts to avoid Discord rate limits. */
	delayMs?: number;
	/** Optional hard cap for a partial run. */
	limit?: number;
}

export interface BackfillRunResult {
	dryRun: boolean;
	candidates: BackfillCandidate[];
	posted: RareAnnounceResult[];
	skippedAlreadyAnnounced: number;
	message: string;
}

async function loadAlreadyAnnounced(): Promise<Set<string>> {
	await ensureBackfillStore();
	const rows = await prisma.$queryRawUnsafe<{ user_id: string; item_id: number }[]>(
		`SELECT user_id, item_id FROM bsc_announcement_backfill`
	);
	return new Set(rows.map((r: { user_id: string; item_id: number }) => `${r.user_id}:${r.item_id}`));
}

async function markAnnounced(userId: string, itemID: number) {
	await ensureBackfillStore();
	await prisma.$executeRawUnsafe(
		`INSERT INTO bsc_announcement_backfill (user_id, item_id) VALUES ($1, $2)
		 ON CONFLICT (user_id, item_id) DO NOTHING`,
		userId,
		itemID
	);
}

/**
 * Find players who already own announceable custom pets / Discord-event rares
 * in their collection log, excluding pairs already backfill-announced.
 */
export async function findBackfillCandidates(limit?: number): Promise<{
	candidates: BackfillCandidate[];
	skippedAlreadyAnnounced: number;
}> {
	const itemIDs = backfillTargetItemIDs();
	const already = await loadAlreadyAnnounced();
	const candidates: BackfillCandidate[] = [];
	let skippedAlreadyAnnounced = 0;

	for (const itemID of itemIDs) {
		if (!Number.isInteger(itemID)) continue;
		const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`
			SELECT id
			FROM users
			WHERE ("collectionLogBank"->>'${itemID}') IS NOT NULL
			  AND ("collectionLogBank"->>'${itemID}')::int >= 1
			ORDER BY id ASC
		`);
		const kind = kindFor(itemID);
		if (!kind) continue;
		const itemName = Items.get(itemID)?.name ?? String(itemID);
		for (const row of rows) {
			const key = `${row.id}:${itemID}`;
			if (already.has(key)) {
				skippedAlreadyAnnounced++;
				continue;
			}
			candidates.push({ userId: row.id, itemID, itemName, kind });
			if (limit && candidates.length >= limit) {
				return { candidates, skippedAlreadyAnnounced };
			}
		}
	}

	return { candidates, skippedAlreadyAnnounced };
}

export async function markCatchUpAnnounced(candidates: BackfillCandidate[]) {
	for (const c of candidates) {
		await markAnnounced(c.userId, c.itemID);
	}
}

export interface StartupCatchUpResult {
	/** Display lines for the restart embed (already capped). */
	lines: string[];
	/** How many candidates were not shown (still recorded). */
	hidden: number;
	/** Full candidate list to mark announced. */
	candidates: BackfillCandidate[];
}

/**
 * One-time catch-up block for the restart message.
 * Groups by item: `Item - Player1, Player2`. Marks all candidates announced.
 */
export async function formatStartupCatchUp(cap = 15): Promise<StartupCatchUpResult> {
	const { candidates } = await findBackfillCandidates();
	if (candidates.length === 0) {
		return { lines: [], hidden: 0, candidates: [] };
	}

	const byItem = new Map<string, string[]>();
	for (const c of candidates) {
		const name = (await Cache.getUsername(c.userId)) || c.userId;
		const list = byItem.get(c.itemName) ?? [];
		list.push(name);
		byItem.set(c.itemName, list);
	}

	const grouped: string[] = [];
	for (const [itemName, players] of byItem) {
		grouped.push(`${itemName} - ${players.join(', ')}`);
	}
	// Prefer shorter groups first so more items fit the cap
	grouped.sort((a, b) => a.length - b.length || a.localeCompare(b));

	const lines = grouped.slice(0, cap);
	const hidden = Math.max(0, grouped.length - lines.length);
	return { lines, hidden, candidates };
}

/** Admin-only: dry-run or rate-limited individual Notification posts. */
export async function runAnnouncementBackfill(options: BackfillRunOptions): Promise<BackfillRunResult> {
	const { dryRun, delayMs = 1500, limit } = options;
	const { candidates, skippedAlreadyAnnounced } = await findBackfillCandidates(limit);
	const posted: RareAnnounceResult[] = [];

	if (dryRun) {
		const preview = candidates
			.slice(0, 50)
			.map(c => `- <@${c.userId}> - ${c.itemName} (${c.kind})`)
			.join('\n');
		const extra = candidates.length > 50 ? `\n...and ${candidates.length - 50} more` : '';
		return {
			dryRun: true,
			candidates,
			posted,
			skippedAlreadyAnnounced,
			message: [
				`**Announcement backfill dry-run**`,
				`Would announce **${candidates.length}** player/item pairs.`,
				`Already announced (skipped): **${skippedAlreadyAnnounced}**.`,
				preview || '(none)',
				extra,
				``,
				`Normal catch-up is automatic on restart. Use dry_run:false only to re-post individual Notification embeds.`
			]
				.filter(line => line !== undefined)
				.join('\n')
		};
	}

	for (const candidate of candidates) {
		const user = await mUserFetch(candidate.userId);
		const result = await announceRareAcquisition({
			user,
			itemID: candidate.itemID,
			kind: candidate.kind,
			dryRun: false
		});
		await markAnnounced(candidate.userId, candidate.itemID);
		posted.push(result);
		if (delayMs > 0) await sleep(delayMs);
	}

	return {
		dryRun: false,
		candidates,
		posted,
		skippedAlreadyAnnounced,
		message: [
			`**Announcement backfill complete**`,
			`Posted **${posted.length}** announcements.`,
			`Already announced (skipped): **${skippedAlreadyAnnounced}**.`
		].join('\n')
	};
}

/** SQL applied at runtime (also list in the PR). No prisma db push. */
export const ANNOUNCEMENT_BACKFILL_SQL = `
CREATE TABLE IF NOT EXISTS bsc_announcement_backfill (
	user_id text NOT NULL,
	item_id int NOT NULL,
	announced_at timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY (user_id, item_id)
);
`.trim();
