import { stringMatches, toTitleCase } from '@oldschoolgg/toolkit';

import { CollectionLogFlags, clImageGenerator, collectionLogTypes } from '@/lib/collectionLogTask.js';
import { allCollectionLogs, buildItemCollection } from '@/lib/data/Collections.js';
import { getUnreleasedItemIDs } from '@/lib/discontinuedItems.js';

export const collectionLogCommand = defineCommand({
	name: 'cl',
	description: 'See your Collection Log.',
	attributes: {
		requiresMinion: true,
		examples: ['/cl name:Boss']
	},
	options: [
		{
			type: 'String',
			name: 'name',
			description: 'The log you want to see.',
			required: true,
			autocomplete: async ({ value, user }: StringAutoComplete) => {
				const canSeeUnreleased = user.isAdmin() || user.isDeveloper();
				return [
					{ name: 'Overall (Main Collection Log)', value: 'overall' },
					{ name: 'Overall+', value: 'overall+' },
					...(canSeeUnreleased
						? [
								{
									name: `Unreleased (${getUnreleasedItemIDs().length} Items, staff only)`,
									value: 'unreleased'
								}
							]
						: []),
					...Object.entries(allCollectionLogs)
						.map(i => {
							return [
								{ name: `${i[0]} (Group)`, value: i[0] },
								...Object.entries(i[1].activities).map(act => ({
									name: `${act[0]} (${act[1].items.length} Items)`,
									value: act[0]
								}))
							];
						})
						.flat(3)
				].filter(i => (!value ? true : i.name.toLowerCase().includes(value.toLowerCase())));
			}
		},
		{
			type: 'String',
			name: 'type',
			description: 'The type of log you want to see.',
			required: false,
			choices: collectionLogTypes.map(i => ({
				name: `${toTitleCase(i.name)} (${i.description})`,
				value: i.name
			}))
		},
		{
			type: 'String',
			name: 'flag',
			description: 'The flag you want to pass.',
			required: false,
			choices: CollectionLogFlags.map(i => ({
				name: `${toTitleCase(i.name)} (${i.description})`,
				value: i.name
			}))
		},
		{
			type: 'String',
			name: 'flag_extra',
			description: 'An additional flag you want to pass.',
			required: false,
			choices: CollectionLogFlags.map(i => ({
				name: `${toTitleCase(i.name)} (${i.description})`,
				value: i.name
			}))
		},
		{
			type: 'Boolean',
			name: 'all',
			description: 'Show all items?',
			required: false
		}
	],
	run: async ({ options, user, interaction }) => {
		const flags: Record<string, string> = {};
		if (options.flag) flags[options.flag] = options.flag;
		if (options.flag_extra) flags[options.flag_extra] = options.flag_extra;
		if (options.all) flags.all = 'all';
		await interaction.defer();
		const type = options.type ?? 'collection';
		const showUnreleased = stringMatches(options.name, 'unreleased') && (user.isAdmin() || user.isDeveloper());
		return await clImageGenerator.generateLogImage({
			user,
			type,
			flags,
			collection: showUnreleased ? '' : options.name,
			collectionLog: showUnreleased
				? await buildItemCollection({ user, name: 'Unreleased', items: getUnreleasedItemIDs(), logType: type })
				: undefined,
			stats: await user.fetchMStats()
		});
	}
});
