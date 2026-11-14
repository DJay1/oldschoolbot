import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { thanksgivingFeast, thanksgivingOffer, thanksgivingStatus } from '@/lib/events/thanksgiving/offer.js';

export const thanksgivingCommand = defineCommand({
	name: 'thanksgiving',
	description: 'The Straw Hat Harvest: offer cornucopias and check your progress.',
	options: [
		{
			type: 'Subcommand',
			name: 'offer',
			description: 'Offer Bountiful cornucopias, or a Harvest turkey for a 2x loot or XP feast.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'What to offer (default Bountiful cornucopia).',
					required: false,
					choices: [
						{ name: 'Bountiful cornucopia', value: 'cornucopia' },
						{ name: 'Harvest turkey (random 2x loot or XP feast)', value: 'turkey' }
					]
				},
				{
					type: 'String',
					name: 'quantity',
					description:
						"How many cornucopias: a number or 'all' (default: all you own). Turkeys go one at a time.",
					required: false,
					autocomplete: async ({ value, userId }: StringAutoComplete) => {
						const user = await mUserFetch(userId);
						const owned = user.bank.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA);
						const choices = [{ name: `All (${owned.toLocaleString()})`, value: 'all' }];
						const typed = (value ?? '').trim();
						if (/^\d[\d,]*$/.test(typed)) choices.unshift({ name: typed, value: typed });
						return choices;
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'status',
			description: 'See your offers, Gobble Streak, guarantee progress, and Harvest feast.'
		}
	],
	run: async ({ options, user, rng }) => {
		if (options.offer) {
			if (options.offer.item === 'turkey') return thanksgivingFeast(user, rng);
			return thanksgivingOffer(user, options.offer.quantity, rng);
		}
		return thanksgivingStatus(user);
	}
});
