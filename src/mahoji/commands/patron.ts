import { PerkTier } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import { getBscPatronAccount, updateBscPatronAccount } from '@/lib/bsc/patronAccount.js';
import {
	buyPatronDye,
	formatPatronDyeShop,
	loadPatronDyesForUser,
	undyePatronItem,
	usePatronDye
} from '@/lib/bsc/patronDyeShop.js';
import { PATRON_DYE_ITEM_IDS, PATRON_DYES, patronDyeById } from '@/lib/bsc/patronDyes.js';
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

async function requirePatron(user: MUser) {
	return (await user.fetchPerkTier()) < PerkTier.Two ? patronMsg(PerkTier.Two) : null;
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
			'/patron dyes buy:Biscuit',
			'/patron dye item:Bandos chestplate dye:Fetch',
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
			description: 'Show your shareable patron profile card. Pup and up, including gift and staff patrons.',
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
			description: 'Check your patron points, browse the dye shop, or buy a dye. Pup and up.',
			options: [
				{
					type: 'String',
					name: 'buy',
					description: 'Buy this dye with patron points.',
					required: false,
					autocomplete: async ({ value }: StringAutoComplete) => {
						const q = (value ?? '').toLowerCase();
						return PATRON_DYES.filter(
							dye => !q || dye.name.toLowerCase().includes(q) || dye.key.includes(q)
						).map(dye => ({ name: `${dye.name} (${dye.points} pts)`, value: dye.key }));
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'dye',
			description: 'Use a patron dye on an item in your bank. Pup and up.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The bank item to dye.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => {
						const q = (value ?? '').toLowerCase();
						return user.bank
							.items()
							.filter(([item]) => !patronDyeById(item.id) && !PATRON_DYE_ITEM_IDS.has(item.id))
							.filter(
								([item]) =>
									!q ||
									item.name.toLowerCase().includes(q) ||
									String(item.id) === q
							)
							.slice(0, 25)
							.map(([item, qty]) => ({ name: `${item.name} (${qty})`, value: String(item.id) }));
					}
				},
				{
					type: 'String',
					name: 'dye',
					description: 'The dye you own.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => {
						const q = (value ?? '').toLowerCase();
						return PATRON_DYES.filter(dye => user.bank.amount(dye.itemID) > 0)
							.filter(dye => !q || dye.name.toLowerCase().includes(q) || dye.key.includes(q))
							.map(dye => ({
								name: `${dye.name} (${user.bank.amount(dye.itemID)} in bank)`,
								value: dye.key
							}));
					}
				},
				{
					type: 'String',
					name: 'mode',
					description: 'recolour, glow, or recolour_glow (default).',
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
			name: 'undye',
			description: 'Remove a patron dye from an item and return the dye to your bank. Pup and up.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The dyed item to restore.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => {
						const q = (value ?? '').toLowerCase();
						const applied = await loadPatronDyesForUser(user.id);
						const choices: { name: string; value: string }[] = [];
						for (const row of applied) {
							const item = Items.get(row.itemID);
							const name = item?.name ?? `Item ${row.itemID}`;
							if (q && !name.toLowerCase().includes(q) && String(row.itemID) !== q) continue;
							choices.push({
								name: `${name} (${row.dyeKey.replaceAll('_', ' ')})`,
								value: String(row.itemID)
							});
							if (choices.length >= 25) break;
						}
						return choices;
					}
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
			const gated = await requirePatron(user);
			if (gated) return gated;
			if (options.profile.favorite_pet) {
				const result = await setFavoritePatronPet(user, options.profile.favorite_pet);
				if (result.message.startsWith('Pick a pet')) return result.message;
			}
			const card = await generatePatronProfileCard(user);
			return {
				content: card.caption,
				files: [{ name: 'patron-profile.png', buffer: card.image }]
			};
		}
		if (options.dye) {
			const isPatron = (await user.fetchPerkTier()) >= PerkTier.Two;
			const ownsDye = PATRON_DYES.some(dye => user.bank.amount(dye.itemID) > 0);
			if (!isPatron && !ownsDye) return DYE_SUBSCRIBE_MSG;
			return usePatronDye(user, options.dye.dye, options.dye.item, options.dye.mode, {
				glowHex: options.dye.glow_hex,
				recolourHex: options.dye.recolour_hex,
				sparkle: options.dye.sparkle
			});
		}
		if (options.undye) {
			const isPatron = (await user.fetchPerkTier()) >= PerkTier.Two;
			if (!isPatron) {
				const applied = await loadPatronDyesForUser(user.id);
				if (applied.length === 0) return DYE_SUBSCRIBE_MSG;
			}
			return undyePatronItem(user, options.undye.item);
		}
		if (options.dyes) {
			if ((await user.fetchPerkTier()) < PerkTier.Two) return DYE_SUBSCRIBE_MSG;
			if (options.dyes.buy) return buyPatronDye(user, options.dyes.buy);
			const [account, applied] = await Promise.all([
				getBscPatronAccount(user.id),
				loadPatronDyesForUser(user.id)
			]);
			return formatPatronDyeShop(account.pointsBalance, applied);
		}
		return patronOverview(user);
	}
});
