import { EmbedBuilder } from '@oldschoolgg/discord';
import { Items, itemID } from 'oldschooljs';

import { customPetsCL } from '@/lib/bso/collection-log/main.js';
import { Channel } from '@/lib/constants.js';
import { LaunchItem } from '@/lib/events/launch/items.js';
import { countUsersWithItemInCl } from '@/lib/rawSql.js';

export type RareAnnounceKind = 'custom_pet' | 'discord_event_rare' | 'rare_drop';

/** Discord-event launch rares that should announce with a received-so-far count. */
export const DISCORD_EVENT_RARE_NAMES = ['Kuro', 'Gregoyle', 'Corgo party hat', 'Flappy'] as const;

export const DISCORD_EVENT_RARE_IDS: readonly number[] = [
	itemID('Kuro'),
	itemID('Gregoyle'),
	LaunchItem.CORGO_PARTY_HAT,
	itemID('Flappy')
];

const customPetIdSet = new Set(customPetsCL);
const discordEventRareIdSet = new Set(DISCORD_EVENT_RARE_IDS);

export function isCustomPetItem(itemID: number): boolean {
	return customPetIdSet.has(itemID);
}

export function isDiscordEventRareItem(itemID: number): boolean {
	return discordEventRareIdSet.has(itemID);
}

export function itemIconUrl(itemID: number): string {
	return `https://raw.githubusercontent.com/runelite/static.runelite.net/gh-pages/cache/item/icon/${itemID}.png`;
}

export function rareAnnounceKindForItem(itemID: number): RareAnnounceKind | null {
	if (isCustomPetItem(itemID)) return 'custom_pet';
	if (isDiscordEventRareItem(itemID)) return 'discord_event_rare';
	return null;
}

function kindTitle(kind: RareAnnounceKind): string {
	switch (kind) {
		case 'custom_pet':
			return 'Custom Pet';
		case 'discord_event_rare':
			return 'Discord Event Rare';
		case 'rare_drop':
			return 'Rare Drop';
	}
}

function kindColor(kind: RareAnnounceKind): number {
	switch (kind) {
		case 'custom_pet':
			return 0x57_f2_87;
		case 'discord_event_rare':
			return 0xeb_45_9e;
		case 'rare_drop':
			return 0xfa_a6_1a;
	}
}

export interface RareAnnounceInput {
	user: MUser;
	itemID: number;
	kind: RareAnnounceKind;
	progressLabel?: string;
	progressValue?: number;
	thanksToUserId?: string;
	dryRun?: boolean;
}

export interface RareAnnounceResult {
	itemID: number;
	itemName: string;
	kind: RareAnnounceKind;
	receivedSoFar: number;
	embed: EmbedBuilder;
	posted: boolean;
}

export function buildRareAnnounceEmbed(input: {
	badgedUsername: string;
	itemName: string;
	itemID: number;
	kind: RareAnnounceKind;
	receivedSoFar: number;
	progressLabel?: string;
	progressValue?: number;
	thanksToUserId?: string;
}): EmbedBuilder {
	const lines = [`**${input.badgedUsername}** received **${input.itemName}**`];
	if (input.progressLabel && input.progressValue !== undefined) {
		lines.push(`${input.progressLabel}: **${input.progressValue.toLocaleString()}**`);
	}
	lines.push(`Received so far: **${input.receivedSoFar.toLocaleString()}**`);
	if (input.thanksToUserId) {
		lines.push(`Thanks to <@${input.thanksToUserId}>`);
	}

	return new EmbedBuilder()
		.setColor(kindColor(input.kind))
		.setTitle(kindTitle(input.kind))
		.setDescription(lines.join('\n'))
		.setThumbnail(itemIconUrl(input.itemID));
}

export async function announceRareAcquisition(input: RareAnnounceInput): Promise<RareAnnounceResult> {
	const item = Items.get(input.itemID) ?? Items.getOrThrow(input.itemID);
	const receivedSoFar = await countUsersWithItemInCl(input.itemID, false);
	const embed = buildRareAnnounceEmbed({
		badgedUsername: input.user.badgedUsername,
		itemName: item.name,
		itemID: input.itemID,
		kind: input.kind,
		receivedSoFar,
		progressLabel: input.progressLabel,
		progressValue: input.progressValue,
		thanksToUserId: input.thanksToUserId
	});

	if (!input.dryRun) {
		await globalClient.sendMessage(Channel.Notifications, {
			embeds: [embed],
			allowedMentions: { parse: [], users: [], roles: [] }
		});
	}

	return {
		itemID: input.itemID,
		itemName: item.name,
		kind: input.kind,
		receivedSoFar,
		embed,
		posted: !input.dryRun
	};
}

export async function announceNewClRares({
	user,
	newItemIDs,
	dryRun = false
}: {
	user: MUser;
	newItemIDs: number[];
	dryRun?: boolean;
}): Promise<RareAnnounceResult[]> {
	const results: RareAnnounceResult[] = [];
	for (const itemID of newItemIDs) {
		const kind = rareAnnounceKindForItem(itemID);
		if (!kind) continue;
		results.push(
			await announceRareAcquisition({
				user,
				itemID,
				kind,
				dryRun
			})
		);
	}
	return results;
}
