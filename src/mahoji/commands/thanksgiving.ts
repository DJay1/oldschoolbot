import { thanksgivingOffer, thanksgivingStatus } from '@/lib/events/thanksgiving/offer.js';

export const thanksgivingCommand = defineCommand({
	name: 'thanksgiving',
	description: 'The Straw Hat Harvest: offer cornucopias and check your progress.',
	options: [
		{
			type: 'Subcommand',
			name: 'offer',
			description: 'Offer Bountiful cornucopias for supplies and a chance at rares.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'How many to offer (default 1, up to as many as you own).',
					required: false,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'status',
			description: 'See your offers, Gobble Streak, and guarantee progress.'
		}
	],
	run: async ({ options, user, rng }) => {
		if (options.offer) {
			return thanksgivingOffer(user, options.offer.quantity, rng);
		}
		return thanksgivingStatus(user);
	}
});
