import {
	findQualityCheckItem,
	QUALITY_CHECK_TAG_PRIORITY,
	type QualityCheckBountyStatus,
	qualityCheckCampaign
} from '@/lib/qualityChecks/config.js';

const ITEM_ID = '[a-z0-9]+(?:-[a-z0-9]+)*';
const markerPattern = new RegExp(`\\[qc:(${ITEM_ID})\\]`, 'gi');
const claimedByPattern = /Claimed by <@!?(\d{15,20})>/g;
const BUTTON_ACTIONS = ['claim', 'done', 'confirm', 'reject'] as const;

export type QualityCheckButtonAction = (typeof BUTTON_ACTIONS)[number];

export interface ImageAttachment {
	content_type?: string | null;
	filename?: string | null;
	width?: number | null;
}

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp)$/i;

export function isDiscordSnowflake(id: string): boolean {
	return /^\d{15,20}$/.test(id);
}

export function cleanQualityCheckNote(note: string | undefined | null): string | null {
	if (!note) return null;
	const cleaned = note.replace(/\s+/g, ' ').trim();
	if (!cleaned) return null;
	return cleaned.slice(0, 400);
}

export function bountyMarker(itemId: string): string {
	return `[qc:${itemId}]`;
}

export function itemIdsIn(content: string): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const match of content.matchAll(markerPattern)) {
		const id = match[1]?.toLowerCase();
		if (!id || seen.has(id) || !findQualityCheckItem(id)) continue;
		seen.add(id);
		ids.push(id);
	}
	return ids;
}

/** One starter marker wins. Several markers match nothing. Otherwise the thread title can match a label or id. */
export function matchBountyItem(content: string, threadName: string | null | undefined): string | null {
	const ids = itemIdsIn(content);
	if (ids.length > 1) return null;
	if (ids.length === 1) return ids[0] ?? null;
	const name = threadName?.trim();
	if (!name) return null;
	const byName = qualityCheckCampaign.items.find(item => item.label === name || item.id === name);
	return byName?.id ?? null;
}

export function bountyStatusFromTagNames(names: readonly string[]): QualityCheckBountyStatus | null {
	const present = new Set(names);
	for (const status of QUALITY_CHECK_TAG_PRIORITY) {
		if (present.has(status)) return status;
	}
	return null;
}

export function latestClaimerId(contents: readonly string[]): string | null {
	let found: string | null = null;
	for (const content of contents) {
		for (const match of content.matchAll(claimedByPattern)) {
			if (match[1]) found = match[1];
		}
	}
	return found;
}

export function isImageAttachment(attachment: ImageAttachment): boolean {
	if (attachment.content_type?.toLowerCase().startsWith('image/')) return true;
	if (typeof attachment.width === 'number' && attachment.width > 0) return true;
	if (attachment.filename && IMAGE_EXTENSION.test(attachment.filename)) return true;
	return false;
}

export function qualityCheckButtonCustomId(
	action: QualityCheckButtonAction,
	campaignId: string,
	itemId: string
): string {
	return `QC:${action}:${campaignId}:${itemId}`;
}

export function parseQualityCheckButtonId(
	customId: string
): { action: QualityCheckButtonAction; campaignId: string; itemId: string } | null {
	const parts = customId.split(':');
	if (parts.length !== 4 || parts[0] !== 'QC') return null;
	const action = parts[1];
	const campaignId = parts[2];
	const itemId = parts[3];
	if (!action || !campaignId || !itemId) return null;
	if (!(BUTTON_ACTIONS as readonly string[]).includes(action)) return null;
	return { action: action as QualityCheckButtonAction, campaignId, itemId };
}
