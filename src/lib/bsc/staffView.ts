import { GearSetupTypes } from '@oldschoolgg/gear';
import { stringMatches, toTitleCase } from '@oldschoolgg/toolkit';

import type { StringAutoComplete } from '@/discord/commands/commandOptions.js';
import { resolveBotSendableMessage } from '@/discord/utils.js';
import { gifs } from '@/lib/bsc/corgoGifs.js';
import { staffGuildAllowed } from '@/lib/bsc/staffAccess.js';
import type { StaffTier } from '@/lib/bsc/staffTiers.js';
import { clImageGenerator } from '@/lib/collectionLogTask.js';
import { allCollectionLogs } from '@/lib/data/Collections.js';
import { registerDiscontinuedCollectionLogs } from '@/lib/discontinuedItems.js';
import { fetchUserStats } from '@/lib/util/fetchUserStats.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { minionStatsEmbed } from '@/lib/util/minionStatsEmbed.js';
import { getUserInfo } from '@/mahoji/commands/minion.js';
import { gearViewCommand } from '@/mahoji/lib/abstracted_commands/gearCommands.js';
import { dataPoints } from '@/mahoji/lib/abstracted_commands/statCommand.js';

export const STAFF_NO_MENTIONS: NonNullable<BaseSendableMessage['allowedMentions']> = {
	parse: [],
	users: [],
	roles: []
};

export const STAFF_PRIVATE_SUBCOMMANDS = ['help', 'view'] as const;

export const STAFF_VIEW_TYPES = ['stats', 'data', 'bank', 'cl', 'gear', 'info'] as const;
export type StaffViewType = (typeof STAFF_VIEW_TYPES)[number];

export const STAFF_VIEW_TYPE_CHOICES = [
	{ name: 'Minion stats', value: 'stats' },
	{ name: 'Data (same as /data)', value: 'data' },
	{ name: 'Bank', value: 'bank' },
	{ name: 'Collection log', value: 'cl' },
	{ name: 'Gear', value: 'gear' },
	{ name: 'Account info', value: 'info' }
] as const;

export const DISCORD_CONTENT_LIMIT = 2000;
export const DISCORD_EMBED_TITLE_LIMIT = 256;
export const DISCORD_EMBED_FIELD_VALUE_LIMIT = 1024;
export const DISCORD_EMBED_TOTAL_LIMIT = 6000;
export const DISCORD_LENGTH_MARGIN = 150;

const TOO_LONG_CONTENT = 'The result was too long (over 2000 characters), please read the attached file.';

export function staffDeniedReply(
	guildId: string | null | undefined,
	tier: StaffTier,
	rng: Pick<RNGProvider, 'pick'>
): string | null {
	if (!staffGuildAllowed(guildId) || tier === 'none') return rng.pick(gifs);
	return null;
}

export function isStaffViewType(value: string): value is StaffViewType {
	return (STAFF_VIEW_TYPES as readonly string[]).includes(value);
}

/** Player label used in staff replies. Never a mention, so the target is not pinged. */
export function staffViewPlayerLabel(user: { username: string; id: string }): string {
	return `${user.username} [${user.id}]`;
}

export function staffViewHeading(kind: string, user: { username: string; id: string }): string {
	return `${kind} for ${staffViewPlayerLabel(user)}`;
}

export function withStaffViewMentionsDisabled(message: SendableMessage): BaseSendableMessage {
	if (typeof message === 'string') {
		return { content: message, allowedMentions: STAFF_NO_MENTIONS };
	}
	return { ...(message as BaseSendableMessage), allowedMentions: STAFF_NO_MENTIONS };
}

export function staffViewSafeMessage(message: SendableMessage): BaseSendableMessage {
	const base = typeof message === 'string' ? { content: message } : { ...(message as BaseSendableMessage) };
	const content = base.content ?? '';
	if (content.length > DISCORD_CONTENT_LIMIT) {
		return {
			...base,
			content: TOO_LONG_CONTENT,
			files: [...(base.files ?? []), { buffer: Buffer.from(content), name: 'staff-view.txt' }],
			allowedMentions: STAFF_NO_MENTIONS
		};
	}
	return { ...base, allowedMentions: STAFF_NO_MENTIONS };
}

function findRawOptionValue(options: StringAutoComplete['rawOptions'], optionName: string): string | null {
	for (const option of options ?? []) {
		if (option.name === optionName && 'value' in option && typeof option.value === 'string') {
			return option.value;
		}
		if ('options' in option) {
			const nested = findRawOptionValue(option.options, optionName);
			if (nested !== null) return nested;
		}
	}
	return null;
}

function autocompleteChoices(entries: { name: string; value: string }[], search: string) {
	const q = search.toLowerCase();
	return entries
		.filter(i => (!q ? true : i.name.toLowerCase().includes(q) || i.value.toLowerCase().includes(q)))
		.slice(0, 25);
}

export async function staffViewNameAutoComplete({ value, rawOptions }: StringAutoComplete) {
	const type = findRawOptionValue(rawOptions, 'type');
	if (type === 'data') {
		return autocompleteChoices(
			dataPoints.map(i => ({ name: i.name, value: i.name })),
			value
		);
	}
	if (type === 'cl') {
		registerDiscontinuedCollectionLogs();
		const entries = [
			{ name: 'Overall (Main Collection Log)', value: 'overall' },
			{ name: 'Overall+', value: 'overall+' },
			...Object.entries(allCollectionLogs).flatMap(([group, data]) => [
				{ name: `${group} (Group)`, value: group },
				...Object.entries(data.activities).map(([act, info]) => ({
					name: `${act} (${info.items.length} Items)`,
					value: act
				}))
			])
		];
		return autocompleteChoices(entries, value);
	}
	if (type === 'gear') {
		const entries = ['all', ...GearSetupTypes, 'Lost on wildy death'].map(i => ({
			name: toTitleCase(i),
			value: i
		}));
		return autocompleteChoices(entries, value);
	}
	return [];
}

async function withHeading(result: Awaited<CommandResponse>, heading: string): Promise<BaseSendableMessage> {
	if (typeof result === 'number') {
		return staffViewSafeMessage(heading);
	}
	const base = await resolveBotSendableMessage(result);
	const content = base.content ? `${heading}\n${base.content}` : heading;
	return staffViewSafeMessage({ ...base, content });
}

export async function runStaffView({
	target,
	type,
	name
}: {
	target: MUser;
	type: string;
	name?: string | null;
}): Promise<BaseSendableMessage> {
	if (!isStaffViewType(type)) {
		return staffViewSafeMessage('Pick a view type: stats, data, bank, cl, gear, or info.');
	}

	switch (type) {
		case 'stats': {
			const embed = await minionStatsEmbed({ user: target });
			return staffViewSafeMessage({
				content: staffViewHeading('Minion stats', target),
				embeds: [embed]
			});
		}
		case 'data': {
			const statName = name?.trim();
			if (!statName) {
				return staffViewSafeMessage('Pick a stat name with the name option. The names are the same as /data.');
			}
			const dataPoint = dataPoints.find(dp => stringMatches(dp.name, statName));
			if (!dataPoint) return staffViewSafeMessage('Invalid stat name.');
			const userStats = await fetchUserStats(target.id);
			const result = await dataPoint.run(target, userStats);
			return withHeading(result, staffViewHeading('Data', target));
		}
		case 'bank': {
			const bank = target.allItemsOwned;
			return staffViewSafeMessage({
				content: staffViewHeading('Bank', target),
				files: [await makeBankImage({ bank, title: `${target.username}'s Bank` })]
			});
		}
		case 'cl': {
			registerDiscontinuedCollectionLogs();
			const collection = name?.trim() || 'overall';
			const result = await clImageGenerator.generateLogImage({
				user: target,
				type: 'collection',
				flags: {},
				collection,
				stats: await target.fetchMStats()
			});
			return withHeading(result, staffViewHeading('Collection log', target));
		}
		case 'gear': {
			const setup = name?.trim() || 'all';
			const result = await gearViewCommand(target, setup, false);
			return withHeading(result, staffViewHeading('Gear', target));
		}
		case 'info': {
			const info = await getUserInfo(target);
			return staffViewSafeMessage({
				content: `${staffViewHeading('Account info', target)}\n${info.everythingString}`
			});
		}
	}
}
