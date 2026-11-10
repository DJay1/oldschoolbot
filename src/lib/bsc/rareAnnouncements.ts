import { customPetsCL } from '@/lib/bso/collection-log/main.js';

import { formatOrdinal, toTitleCase } from '@oldschoolgg/toolkit';
import { Items, itemID } from 'oldschooljs';

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

type SkillLevels = MUser['skillsAsLevels'];

const skillingPetSkills = new Map<number, keyof SkillLevels>([
	[itemID('Doug'), 'mining'],
	[itemID('Remy'), 'cooking'],
	[itemID('Shelldon'), 'fishing'],
	[itemID('Zak'), 'smithing'],
	[itemID('Peky'), 'woodcutting'],
	[itemID('Obis'), 'runecraft'],
	[itemID('Wilvus'), 'thieving'],
	[itemID('Lil lamb'), 'magic'],
	[itemID('Harry'), 'agility'],
	[itemID('Scruffy'), 'agility'],
	[itemID('Skipper'), 'agility'],
	[itemID('Sandy'), 'hunter'],
	[itemID('Herbert'), 'herblore'],
	[itemID('Plopper'), 'farming'],
	[itemID('Fungo'), 'farming'],
	[itemID('Cogsworth'), 'invention'],
	[itemID('Doopy'), 'divination']
]);

export function isCustomPetItem(itemID: number): boolean {
	return customPetIdSet.has(itemID);
}

export function isDiscordEventRareItem(itemID: number): boolean {
	return discordEventRareIdSet.has(itemID);
}

export function rareAnnounceKindForItem(itemID: number): RareAnnounceKind | null {
	if (isCustomPetItem(itemID)) return 'custom_pet';
	if (isDiscordEventRareItem(itemID)) return 'discord_event_rare';
	return null;
}

export interface RareAnnounceInput {
	user: MUser;
	itemID: number;
	kind: RareAnnounceKind;
	dryRun?: boolean;
}

export interface RareAnnounceResult {
	itemID: number;
	itemName: string;
	kind: RareAnnounceKind;
	receivedSoFar: number;
	message: string;
	posted: boolean;
}

export function buildRareAnnounceMessage(input: {
	notificationName: string;
	itemName: string;
	receivedSoFar: number;
	skill?: { name: string; level: number };
}): string {
	const base = `${input.notificationName} just received their first **${input.itemName}**`;
	if (input.skill) {
		return `${base} at level ${input.skill.level} ${toTitleCase(input.skill.name)}!`;
	}
	return `${base}! They are the ${formatOrdinal(input.receivedSoFar)} person to receive one.`;
}

export async function announceRareAcquisition(input: RareAnnounceInput): Promise<RareAnnounceResult> {
	const item = Items.getOrThrow(input.itemID);
	const receivedSoFar = await countUsersWithItemInCl(input.itemID, false);
	const skillName = skillingPetSkills.get(input.itemID);
	const message = buildRareAnnounceMessage({
		notificationName: input.user.notificationName,
		itemName: item.name,
		receivedSoFar,
		skill: skillName ? { name: skillName, level: input.user.skillsAsLevels[skillName] } : undefined
	});

	if (!input.dryRun) {
		await globalClient.sendMessage(Channel.Notifications, {
			content: message,
			allowedMentions: { parse: [], users: [], roles: [] }
		});
	}

	return {
		itemID: input.itemID,
		itemName: item.name,
		kind: input.kind,
		receivedSoFar,
		message,
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
