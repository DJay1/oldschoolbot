import { performBscPatronGift, triggerBscDoubleLoot } from '@/lib/bsc/patronPerks.js';
import { getBscPatronOverride } from '@/lib/bsc/patronStore.js';
import {
	bscPatronLevelFromBits,
	bscPatronTierByLevel,
	formatBscPatronOverview,
	planBscPatronGift
} from '@/lib/bsc/patronTiers.js';

export const patronCommand = defineCommand({
	name: 'patron',
	description: 'Bark School Corgo patron tiers, gifts, and double loot.',
	attributes: {
		examples: ['/patron info', '/patron gift user:@Friend', '/patron double_loot']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'info',
			description: 'Show the patron tiers and your tier.'
		},
		{
			type: 'Subcommand',
			name: 'double_loot',
			description: 'Start your monthly server double loot. Pack Leader and Biggest of Dogs.'
		},
		{
			type: 'Subcommand',
			name: 'gift',
			description: 'Gift 1 week of patron perks. Pack Leader gifts Good Boy. Biggest of Dogs gifts Alpha.',
			options: [
				{
					type: 'User',
					name: 'user',
					description: 'The player who receives 1 week.',
					required: true
				}
			]
		}
	],
	run: async ({ options, user, interaction }) => {
		await interaction.defer();
		if (options.double_loot) return triggerBscDoubleLoot(user);
		if (options.gift) {
			const recipientId = options.gift.user.user.id;
			const recipient = await mUserFetch(recipientId);
			const [donorState, recipientState] = await Promise.all([
				getBscPatronOverride(user.id),
				getBscPatronOverride(recipient.id)
			]);
			const plan = planBscPatronGift({
				donorLevel: bscPatronLevelFromBits(user.bitfield),
				donorLastGiftAt: donorState?.lastGiftAt ?? null,
				recipientLevel: bscPatronLevelFromBits(recipient.bitfield),
				recipientGiftTier: recipientState?.giftTier ?? null,
				recipientGiftUntil: recipientState?.giftUntil ?? null,
				sameUser: user.id === recipient.id,
				recipientName: recipient.usernameOrMention,
				now: Date.now()
			});
			if (!plan.ok) return plan.message;
			const giftName = bscPatronTierByLevel(plan.giftLevel)?.name ?? 'patron';
			await interaction.confirmation(
				`Gift 1 week of ${giftName} to ${recipient.usernameOrMention}? This uses your gift for the next 30 days.`
			);
			return performBscPatronGift(user, recipientId);
		}
		const state = await getBscPatronOverride(user.id);
		const lastDoubleLoot = user.user.last_patron_double_time_trigger;
		return formatBscPatronOverview({
			bits: user.bitfield,
			giftTier: state?.giftTier ?? null,
			giftUntil: state?.giftUntil ?? null,
			lastGiftAt: state?.lastGiftAt ?? null,
			customBackground: state?.customBackground ?? false,
			lastDoubleLootAt: lastDoubleLoot ? lastDoubleLoot.getTime() : null
		});
	}
});
