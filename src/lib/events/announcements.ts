import { Time } from '@oldschoolgg/toolkit';

import { ANNOUNCEMENTS_CHANNEL_ID } from '@/lib/constants.js';
import { thanksgivingCodeEnabled } from '@/lib/events/thanksgiving/core.js';
import { isEventActive, resolveSeasonalEvent } from './registry.js';
import { type SeasonalEventId, seasonalEventIds } from './types.js';

/**
 * Event-start announcements: when a scheduled seasonal event window opens, post its stored message
 * to the BSC announcements channel once.
 *
 * - Only scheduled windows (an override with a start time) are announced, only while the event is
 *   active, and only within EVENT_ANNOUNCE_CATCH_UP_MS of the start (so a bot that was down at the
 *   start still posts on the next run, but a stale window never posts days later).
 * - The post is claimed first in bsc_event_announcements (event id + start time, created at runtime,
 *   no Prisma schema change), so restarts never post twice. An event announced in the last
 *   EVENT_ANNOUNCE_REPEAT_GUARD_MS is not announced again if its start is moved.
 * - No pings: allowedMentions is empty, so <@id> mentions render as names without notifying anyone.
 */

export interface EventStartAnnouncement {
	/** Each entry is one Discord message (max 2000 characters). */
	messages: readonly string[];
	/** Extra code gate for the event (e.g. the Thanksgiving master switch). */
	codeEnabled?: () => boolean;
}

export const DISCORD_MESSAGE_LIMIT = 2000;
export const EVENT_ANNOUNCE_CATCH_UP_MS = 6 * Time.Hour;
export const EVENT_ANNOUNCE_REPEAT_GUARD_MS = 30 * Time.Day;

const THANKSGIVING_TESTERS = [
	'611598764574114049',
	'820763331165159435',
	'603327620234608661',
	'322626810779271169',
	'814501863449165844'
];

export const EVENT_START_ANNOUNCEMENTS: Partial<Record<SeasonalEventId, EventStartAnnouncement>> = {
	thanksgiving: {
		codeEnabled: thanksgivingCodeEnabled,
		messages: [
			[
				'🦃 **THE STRAW HAT HARVEST IS LIVE!** 🏴‍☠️',
				'**Sun Nov 22 – Mon Dec 7 (CT)**',
				'',
				'**How it works**',
				'• Every trip can drop **Harvest bundles** and **Wicker baskets**',
				'• 5 Harvest bundles + 1 Wicker basket makes a **Bountiful cornucopia**',
				'• Offer them with `/thanksgiving offer` (leave quantity blank or pick All to offer every one you have)',
				'• Every offer gives supplies and a chance at the rare stuff',
				'',
				'**Harvest trip**',
				'• `/thanksgiving harvest` sends your minion to gather just Harvest bundles OR just Wicker baskets',
				"• Less overall than a normal trip, and a random amount: it's a catch-up tool, not a shortcut",
				'',
				'**Farming**',
				'• Every harvested patch type whose crop takes 1 hour or more to grow has a 1 in 15 chance at a whole **Bountiful cornucopia**',
				'',
				'**Harvest turkey**',
				'• A rare offer reward. Offer it with `/thanksgiving offer` (pick Harvest turkey) for a 1 in 3 chance at a **Harvest feast**: 2x loot or 2x XP',
				'• A lucky Harvest turkey during a Harvest feast adds more time to it'
			].join('\n'),
			[
				'**Rare rewards & boosts**',
				'• **Gobbles**: 1.4x trip length on every trip, 15% chance each raw food is saved when cooking. Guaranteed by 150 offers',
				'• **Gobble gobble**: all of Gobbles, plus a Pilgrim hat boost',
				'• **Pilgrim hat** (worn): +10% cooking speed, +3% cooking yield',
				'• **Laboon**: 2.2x fishing speed and 1.3x fishing trip length (Aerial fishing included), 2.2x fish from Fishing Trawler and Drift net fishing',
				'• **Captain Laboon**: all of Laboon, plus a Straw hat boost and +7% more fishing yield (+10% total)',
				'• **Straw hat** (worn): +10% fishing speed, +3% fishing yield',
				'• **Harvest Blessing** (own a Cornucopia): +3% cooking yield. During the event: +15% offer supplies and better odds on some offer rewards',
				'• Every Gobbles, Gobble gobble, Laboon and Captain Laboon gets announced, so flex away!',
				'',
				'**Bank backgrounds**',
				'• **Going Merry**: complete The Straw Hat Harvest collection log (Laboon and Captain Laboon not needed)',
				'• **Going Merry (storm)**: an extra version for Patreon supporters (Pup tier and up) with the same log',
				'',
				'Check your progress with `/thanksgiving status`',
				'📄 Full details in the event guide PDF below',
				'',
				'🙏 **Huge thanks to our testers**',
				THANKSGIVING_TESTERS.map(id => `<@${id}>`).join(' '),
				'Thank you for helping shape this event!',
				'',
				'Happy Thanksgiving! 🦃'
			].join('\n')
		]
	}
};

export interface EventWindowState {
	active: boolean;
	start: number | null;
	codeEnabled: boolean;
	hasMessages: boolean;
}

/** Pure check: should this event's start be announced right now? */
export function eventAnnouncementDue(state: EventWindowState, now: number): boolean {
	if (!state.hasMessages || !state.codeEnabled || !state.active) return false;
	if (state.start === null || !Number.isFinite(state.start)) return false;
	if (now < state.start) return false;
	return now - state.start <= EVENT_ANNOUNCE_CATCH_UP_MS;
}

export interface EventAnnouncementStore {
	/** True if this caller claimed the post (first time for this event + start, no recent post). */
	claim(id: SeasonalEventId, start: number): Promise<boolean>;
	/** Undo a claim when nothing was posted, so the next run retries. */
	release(id: SeasonalEventId, start: number): Promise<void>;
}

export type EventAnnouncementSender = (content: string) => Promise<void>;

async function ensureTable() {
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_event_announcements (
			event_id text NOT NULL,
			start_at timestamptz NOT NULL,
			posted_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (event_id, start_at)
		)
	`);
}

export const dbEventAnnouncementStore: EventAnnouncementStore = {
	async claim(id, start) {
		await ensureTable();
		const startAt = new Date(start);
		const guardFrom = new Date(Date.now() - EVENT_ANNOUNCE_REPEAT_GUARD_MS);
		const recent = await prisma.$queryRaw<{ n: number }[]>`
			SELECT 1 AS n FROM bsc_event_announcements
			WHERE event_id = ${id} AND start_at <> ${startAt} AND posted_at > ${guardFrom}
			LIMIT 1
		`;
		if (recent.length > 0) return false;
		const inserted = await prisma.$queryRaw<{ event_id: string }[]>`
			INSERT INTO bsc_event_announcements (event_id, start_at)
			VALUES (${id}, ${startAt})
			ON CONFLICT (event_id, start_at) DO NOTHING
			RETURNING event_id
		`;
		return inserted.length > 0;
	},
	async release(id, start) {
		await prisma.$executeRaw`
			DELETE FROM bsc_event_announcements WHERE event_id = ${id} AND start_at = ${new Date(start)}
		`;
	}
};

function safeLogError(err: unknown, context?: Record<string, unknown>) {
	try {
		Logging.logError(err as Error, context);
	} catch {
		// Logging must never break the ticker.
	}
}

export const announcementsChannelSender: EventAnnouncementSender = async content => {
	await globalClient.sendMessage(ANNOUNCEMENTS_CHANNEL_ID, {
		content,
		allowedMentions: { parse: [], users: [], roles: [] }
	});
};

/**
 * Ticker body. Claims before posting. If the first message fails nothing was posted, so the claim is
 * released and the next run retries. If a later message fails the claim is kept (never double-post).
 */
export async function processEventStartAnnouncements(
	now = Date.now(),
	store: EventAnnouncementStore = dbEventAnnouncementStore,
	send: EventAnnouncementSender = announcementsChannelSender
): Promise<SeasonalEventId[]> {
	const posted: SeasonalEventId[] = [];
	for (const id of seasonalEventIds) {
		const entry = EVENT_START_ANNOUNCEMENTS[id];
		if (!entry) continue;
		const event = resolveSeasonalEvent(id);
		const due = eventAnnouncementDue(
			{
				active: isEventActive(id, now),
				start: event.overridden ? event.start : null,
				codeEnabled: entry.codeEnabled ? entry.codeEnabled() : true,
				hasMessages: entry.messages.length > 0
			},
			now
		);
		if (!due || event.start === null) continue;
		const start = event.start;
		if (!(await store.claim(id, start))) continue;
		let sent = 0;
		try {
			for (const content of entry.messages) {
				await send(content);
				sent++;
			}
			posted.push(id);
		} catch (err) {
			if (sent === 0) await store.release(id, start).catch(e => safeLogError(e));
			safeLogError(err, { source: 'eventStartAnnouncement', event_id: id, sent });
		}
	}
	return posted;
}
