/**
 * Quality-check bounty board.
 *
 * Change these when the bot moves servers. Environment variables override the
 * Los Perros test-server defaults. Leave a variable unset to keep the default.
 *
 *   QUALITY_CHECK_GUILD_ID             Guild / test server snowflake
 *   QUALITY_CHECK_CHANNEL_ID           #qc-bounties forum snowflake
 *   QUALITY_CHECK_UPDATES_CHANNEL_ID   #updates channel snowflake (one quiet notice / ticker ping)
 *   QUALITY_CHECK_ROLE_ID              Quality Checkers role snowflake (mentioned when a bounty is ready for DJ)
 *   QUALITY_CHECK_DJ_USER_ID           Optional user snowflake pinged with the role. Unset = role only
 *   QUALITY_CHECK_TICKER_MINUTES       Reminder interval in minutes. 0 or unset = slash command only
 *   QUALITY_CHECK_THREADS              Optional item-id:thread-id pairs, comma-separated
 *
 * Local command install uses TESTING_SERVER (see src/lib/constants.ts). Point that at the same guild
 * as QUALITY_CHECK_GUILD_ID so /qualitycheck is registered there.
 *
 * The bounty board channel is the Forum #qc-bounties. The old #quality-checks channel is an archive.
 * Do not use that archive channel as the board. #qc-bounties must be a Discord Forum.
 * Forum tag names are locked to Guider's set and matched exactly (case-sensitive):
 *
 *   open | claimed | needs-DJ | passed | failed
 *
 * Stable bounty keys for this campaign (thread snowflakes are stored on quality_check_bounty.thread_id
 * after /qualitycheck post or /qualitycheck sync, and printed by /qualitycheck post):
 *
 *   help-placeholder        title "Help placeholder"         marker [qc:help-placeholder]
 *   invite-placeholder       title "Invite placeholder"        marker [qc:invite-placeholder]
 *   minion-buy-placeholder   title "Minion buy placeholder"    marker [qc:minion-buy-placeholder]
 *   item-hub                 title "Item hub"                  marker [qc:item-hub]
 *   boss-hub                 title "Boss hub"                  marker [qc:boss-hub]
 *   no-patreon-plugs         title "No Patreon plugs"          marker [qc:no-patreon-plugs]
 *
 * An external bot can create the forum posts. Put the marker in the starter message (or set
 * QUALITY_CHECK_THREADS) and run /qualitycheck sync. Confirm is the only action that grants credit.
 * Rewards should call getQualityCheckPassCount from ./index.ts (passed bounties for that claimer).
 *
 * Tester flow on each post: Claim → upload a screenshot in the thread → Done (pings DJ).
 * DJ flow: Confirm ✓ credits the claimer and sets the passed tag. Reject ✗ sets failed and does not credit.
 */

const TEST_SERVER_GUILD_ID = '1564440506866606101';
const TEST_SERVER_UPDATES_CHANNEL_ID = '1564454812349632562';
const TEST_SERVER_QUALITY_CHECKS_CHANNEL_ID = '1564459680997056604';
const TEST_SERVER_QUALITY_CHECKERS_ROLE_ID = '1564455672270290975';

function envId(name: string, fallback: string): string {
	const value = process.env[name]?.trim();
	return value ? value : fallback;
}

function envOptionalId(name: string): string | null {
	const value = process.env[name]?.trim();
	if (!value || !/^\d{15,20}$/.test(value)) return null;
	return value;
}

function envMinutes(name: string): number {
	const raw = process.env[name]?.trim();
	if (!raw) return 0;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return 0;
	return Math.floor(parsed);
}

function envThreadIds(): Readonly<Record<string, string>> {
	const raw = process.env.QUALITY_CHECK_THREADS?.trim();
	if (!raw) return {};
	const map: Record<string, string> = {};
	for (const part of raw.split(',')) {
		const separator = part.indexOf(':');
		if (separator <= 0) continue;
		const itemId = part.slice(0, separator).trim();
		const threadId = part.slice(separator + 1).trim();
		if (!itemId || !/^\d{15,20}$/.test(threadId)) continue;
		map[itemId] = threadId;
	}
	return map;
}

export const qualityCheckConfig = {
	guildId: envId('QUALITY_CHECK_GUILD_ID', TEST_SERVER_GUILD_ID),
	channelId: envId('QUALITY_CHECK_CHANNEL_ID', TEST_SERVER_QUALITY_CHECKS_CHANNEL_ID),
	updatesChannelId: envId('QUALITY_CHECK_UPDATES_CHANNEL_ID', TEST_SERVER_UPDATES_CHANNEL_ID),
	roleId: envId('QUALITY_CHECK_ROLE_ID', TEST_SERVER_QUALITY_CHECKERS_ROLE_ID),
	djUserId: envOptionalId('QUALITY_CHECK_DJ_USER_ID'),
	/** 0 means the ticker is not started. */
	tickerIntervalMinutes: envMinutes('QUALITY_CHECK_TICKER_MINUTES'),
	threadIds: envThreadIds()
} as const;

/** Guider's forum tags. Matched exactly, including needs-DJ. */
export const QUALITY_CHECK_TAGS = ['open', 'claimed', 'needs-DJ', 'passed', 'failed'] as const;
export type QualityCheckBountyStatus = (typeof QUALITY_CHECK_TAGS)[number];

/** When several status tags are applied, the earlier entry wins. */
export const QUALITY_CHECK_TAG_PRIORITY: readonly QualityCheckBountyStatus[] = [
	'passed',
	'needs-DJ',
	'claimed',
	'failed',
	'open'
];

export function isBountyStatus(value: string): value is QualityCheckBountyStatus {
	return (QUALITY_CHECK_TAGS as readonly string[]).includes(value);
}

export interface QualityCheckItem {
	id: string;
	label: string;
	instruction: string;
}

export const qualityCheckCampaign = {
	id: 'pr1-branding-hubs',
	title: 'PR #1 branding and hubs',
	summary: 'Smoke-check placeholder copy, the item hub, and the boss hub.',
	items: [
		{
			id: 'help-placeholder',
			label: 'Help placeholder',
			instruction: 'Run /help. The reply should use NEED TO REPLACE and should not include a Patreon plug.'
		},
		{
			id: 'invite-placeholder',
			label: 'Invite placeholder',
			instruction: 'Run /invite. The reply should be placeholder copy only (NEED TO REPLACE).'
		},
		{
			id: 'minion-buy-placeholder',
			label: 'Minion buy placeholder',
			instruction:
				'Run /minion buy. The success reply should use NEED TO REPLACE and should not include a Patreon plug.'
		},
		{
			id: 'item-hub',
			label: 'Item hub',
			instruction: 'Use an item name that resolves through the item hub (src/lib/items/index.ts).'
		},
		{
			id: 'boss-hub',
			label: 'Boss hub',
			instruction: 'Open a boss whose loot is listed from the boss hub (src/lib/bosses/index.ts).'
		},
		{
			id: 'no-patreon-plugs',
			label: 'No Patreon plugs',
			instruction: 'Read the /help, /invite, and minion buy replies. None of them should include a Patreon plug.'
		}
	]
} as const satisfies {
	id: string;
	title: string;
	summary: string;
	items: readonly QualityCheckItem[];
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSlug(label: string, value: string) {
	if (!slugPattern.test(value)) {
		throw new Error(`Quality check ${label} must be a lowercase slug without colons. Got "${value}".`);
	}
}

assertSlug('campaign id', qualityCheckCampaign.id);
const seenItemIds = new Set<string>();
for (const item of qualityCheckCampaign.items) {
	assertSlug(`item id ${item.label}`, item.id);
	if (seenItemIds.has(item.id)) throw new Error(`Duplicate quality check item id "${item.id}".`);
	seenItemIds.add(item.id);
}

export function findQualityCheckItem(itemId: string) {
	return qualityCheckCampaign.items.find(item => item.id === itemId);
}

export function configuredThreadId(itemId: string): string | null {
	return qualityCheckConfig.threadIds[itemId] ?? null;
}

export const qualityCheckItemChoices = qualityCheckCampaign.items.map(item => ({
	name: item.label,
	value: item.id
}));
