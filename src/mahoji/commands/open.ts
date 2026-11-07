import { truncateString } from '@oldschoolgg/toolkit';
import { clamp } from 'remeda';

import { allOpenables, allOpenablesIDs } from '@/lib/openables.js';
import { validateQuantity } from '@/lib/util/validateQuantity.js';
import {
	abstractedOpenCommand,
	abstractedOpenUntilCommand,
	MAX_OPEN_PER_COMMAND,
	OpenUntilItems
} from '@/mahoji/lib/abstracted_commands/openCommand.js';

export const openCommand = defineCommand({
	name: 'open',
	description: 'Open an item (caskets, keys, boxes, etc).',
	options: [
		{
			type: 'String',
			name: 'name',
			description: 'The thing you want to open.',
			required: false,
			autocomplete: async ({ value, user }: StringAutoComplete) => {
				return user.bank
					.items()
					.filter(i => allOpenablesIDs.has(i[0].id))
					.filter(i => {
						if (!value) return true;
						const openable = allOpenables.find(o => o.id === i[0].id);
						if (!openable) return false;
						return [i[0].name.toLowerCase(), ...openable.aliases].some(val =>
							val.toLowerCase().includes(value.toLowerCase())
						);
					})
					.map(i => ({ name: `${i[0].name} (${i[1]}x Owned)`, value: i[0].name.toLowerCase() }))
					.concat([{ name: 'All (Open Everything)', value: 'all' }]);
			}
		},
		{
			type: 'Integer',
			name: 'quantity',
			description: 'The quantity you want to open (defaults to one).',
			required: false,
			min_value: 1,
			max_value: 100_000
		},
		{
			type: 'String',
			name: 'open_until',
			description: 'Keep opening items until you get this item.',
			required: false,
			autocomplete: async ({ value }: StringAutoComplete) => {
				if (!value) return OpenUntilItems.map(i => ({ name: i.name, value: i.name }));
				return OpenUntilItems.filter(i => i.name.toLowerCase().includes(value.toLowerCase())).map(i => ({
					name: i.name,
					value: i.name
				}));
			}
		},
		{
			type: 'Integer',
			name: 'result_quantity',
			description: 'The quantity of the result item to open until.',
			required: false,
			min_value: 1,
			max_value: 100_000
		},
		{
			type: 'Boolean',
			name: 'disable_pets',
			description: 'Disables octo & smokey when opening.',
			required: false
		}
	],
	run: async ({ user, options, interaction, rng }) => {
		if (interaction) await interaction.defer();
		if (!options.name) {
			return `You have... ${truncateString(
				user.bank.filter(item => allOpenablesIDs.has(item.id)).toString(),
				1950
			)}.`;
		}

		if (options.quantity !== undefined) {
			const parsedQuantity = validateQuantity(options.quantity, {
				min: 1,
				max: MAX_OPEN_PER_COMMAND
			});
			if (!parsedQuantity.ok) return parsedQuantity.error;
			options.quantity = parsedQuantity.value;
		}
		if (options.result_quantity !== undefined) {
			const parsedResultQuantity = validateQuantity(options.result_quantity, {
				min: 1,
				max: 100_000,
				label: 'Result quantity'
			});
			if (!parsedResultQuantity.ok) return parsedResultQuantity.error;
			options.result_quantity = parsedResultQuantity.value;
		}

		options.quantity = clamp(options.quantity ?? 1, { min: 1, max: MAX_OPEN_PER_COMMAND });

		if (options.open_until) {
			return abstractedOpenUntilCommand(
				rng,
				user,
				options.name,
				options.open_until,
				options.quantity,
				options.result_quantity,
				options.disable_pets
			);
		}

		if (options.name.toLowerCase() === 'all') {
			return abstractedOpenCommand(rng, interaction, user, ['all'], 'auto', false);
		}

		return abstractedOpenCommand(rng, interaction, user, [options.name], options.quantity, options.disable_pets);
	}
});
