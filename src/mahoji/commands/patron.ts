import { PerkTier } from '@oldschoolgg/toolkit';

import { getBscPatronAccount, updateBscPatronAccount } from '@/lib/bsc/patronAccount.js';
import {
	buyPatronDye,
	formatPatronDyeShop,
	loadPatronDyesForUser,
	undyePatronItem,
	usePatronDye
} from '@/lib/bsc/patronDyeShop.js';
import { sanitizePatronFlair } from '@/lib/bsc/patronFlair.js';
import { loyaltyBadgeLabel } from '@/lib/bsc/patronLoyalty.js';
import { performBscPatronGift, triggerBscDoubleLoot } from '@/lib/bsc/patronPerks.js';
import { generatePatronProfileCard, setFavoritePatronPet } from '@/lib/bsc/patronProfile.js';
import { getBscPatronOverride } from '@/lib/bsc/patronStore.js';
import {
	bscPatronLevelFromBits,
	bscPatronTierByLevel,
	formatBscPatronOverview,
	planBscPatronGift
} from '@/lib/bsc/patronTiers.js';
import { formatPatronTitleList, parsePatronTitle } from '@/lib/bsc/patronTitles.js';
import { patronMsg } from '@/lib/util/smallUtils.js';

async function patronOverview(user: MUser) {
	const [state, account] = await Promise.all([getBscPatronOverride(user.id), getBscPatronAccount(user.id)]);
	const lastDoubleLoot = user.user.last_patron_double_time_trigger;
	return formatBscPatronOverview({
		bits: user.bitfield,
		giftTier: state?.giftTier ?? null,
		giftUntil: state?.giftUntil ?? null,
		lastGiftAt: state?.lastGiftAt ?? null,
		customBackground: state?.customBackground ?? false,
		lastDoubleLootAt: lastDoubleLoot ? lastDoubleLoot.getTime() : null,
		title: account.title,
		flair: account.flair,
		points: account.pointsBalance,
		monthsTotal: account.monthsTotal,
		monthsStreak: account.monthsStreak,
		loyaltyLabel: loyaltyBadgeLabel(account.monthsTotal, account.monthsStreak)
	});
}

async function requireTopDog(user: MUser) {
	return (await user.fetchPerkTier()) < PerkTier.Four ? patronMsg(PerkTier.Four) : null;
}

export const patronCommand = defineCommand({
	name: 'patron',
	description: 'Bark School Corgo patron tiers, cosmetics, dyes, gifts, and double loot.',
	attributes: {
		examples: [
			'/patron info',
			'/patron title title:Fetch Master',
			'/patron flair text:Back from a treat run',
			'/patron profile',
			'/patron dyes action:buy dye:Biscuit',
			'/patron gift user:@Friend',
			'/patron double_loot'
		]
	},
	options: [
		{
			type: 'Subcommand',
			name: 'info',
			description: 'Show the patron tiers and your tier.'
		},
		{
			type: 'Subcommand',
			name: 'title',
			description: 'Set or clear your Top Dog patron title.',
			options: [
				{
					type: 'String',
					name: 'title',
					description: 'A title from the list, or clear.',
					required: true
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'flair',
			description: 'Set or clear the flair added to your trip-return messages.',
			options: [
				{
					type: 'String',
					name: 'text',
					description: 'Short flair text, or clear.',
					required: true
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'profile',
			description: 'Show your shareable patron profile card. Top Dog and above.',
			options: [
				{
					type: 'String',
					name: 'favorite_pet',
					description: 'A pet you own, or skip to use your most-used pet.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'dyes',
			description: 'Check your patron points, or buy, use, or undye a patron dye.',
			options: [
				{
					type: 'String',
					name: 'action',
					description: 'balance, buy, use, or undye. Defaults to balance.',
					required: false
				},
				{
					type: 'String',
					name: 'dye',
					description: 'Biscuit, Fetch, Pawberry, Midnight Pup, or Golden Corgo.',
					required: false
				},
				{
					type: 'String',
					name: 'item',
					description: 'The bank item to dye or undye.',
					required: false
				},
				{
					type: 'String',
					name: 'mode',
					description: 'recolour, glow, or recolour_glow.',
					required: false
				},
				{
					type: 'String',
					name: 'glow_hex',
					description: 'Golden Corgo only: glow colour as #RRGGBB.',
					required: false
				},
				{
					type: 'String',
					name: 'recolour_hex',
					description: 'Golden Corgo only: item recolour as #RRGGBB.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'sparkle',
					description: 'Golden Corgo only: turn sparkles on or off.',
					required: false
				}
			]
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
		if (options.title) {
			const gated = await requireTopDog(user);
			if (gated) return gated;
			const parsed = parsePatronTitle(options.title.title);
			if (!parsed) {
				return `Pick one of these titles, or use clear: ${formatPatronTitleList()}.`;
			}
			if (parsed === 'clear') {
				await updateBscPatronAccount(user.id, { title: null });
				return 'Your patron title was cleared.';
			}
			await updateBscPatronAccount(user.id, { title: parsed });
			return `Your patron title is now ${parsed}.`;
		}
		if (options.flair) {
			const gated = await requireTopDog(user);
			if (gated) return gated;
			const parsed = sanitizePatronFlair(options.flair.text);
			if (!parsed.ok) return parsed.message;
			if (!parsed.flair) {
				await updateBscPatronAccount(user.id, { flair: null });
				return 'Your trip flair was cleared.';
			}
			await updateBscPatronAccount(user.id, { flair: parsed.flair });
			return `Your trip-return flair is now: ${parsed.flair}`;
		}
		if (options.profile) {
			const gated = await requireTopDog(user);
			if (gated) return gated;
			if (options.profile.favorite_pet) {
				const result = await setFavoritePatronPet(user, options.profile.favorite_pet);
				if (result.message.startsWith('Pick a pet')) return result.message;
			}
			const account = await getBscPatronAccount(user.id);
			if (account.favoritePetId === null && options.profile.favorite_pet !== 'skip') {
				const first = await generatePatronProfileCard(user);
				if (first.needsFavorite) {
					return 'First, pick a favorite pet you own with /patron profile favorite_pet:Pet name, or use favorite_pet:skip to use your most-used pet.';
				}
			}
			const card = await generatePatronProfileCard(user);
			return {
				content: card.caption,
				files: [{ name: 'patron-profile.png', buffer: card.image }]
			};
		}
		if (options.dyes) {
			const action = (options.dyes.action ?? 'balance').trim().toLowerCase();
			if (action === 'buy') {
				if (!options.dyes.dye)
					return 'Name the dye to buy: Biscuit, Fetch, Pawberry, Midnight Pup, or Golden Corgo.';
				return buyPatronDye(user, options.dyes.dye);
			}
			if (action === 'use') {
				if (!options.dyes.dye || !options.dyes.item) {
					return 'Use a dye with /patron dyes action:use dye:Biscuit item:Dragon scimitar mode:recolour_glow.';
				}
				return usePatronDye(user, options.dyes.dye, options.dyes.item, options.dyes.mode, {
					glowHex: options.dyes.glow_hex,
					recolourHex: options.dyes.recolour_hex,
					sparkle: options.dyes.sparkle
				});
			}
			if (action === 'undye') {
				if (!options.dyes.item) return 'Name the item to undye.';
				return undyePatronItem(user, options.dyes.item);
			}
			const [account, applied] = await Promise.all([
				getBscPatronAccount(user.id),
				loadPatronDyesForUser(user.id)
			]);
			return formatPatronDyeShop(account.pointsBalance, applied);
		}
		return patronOverview(user);
	}
});
