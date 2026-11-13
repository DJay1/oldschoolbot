import { PerkTier } from '@oldschoolgg/toolkit';
import { itemArr } from '@/discord/presetCommandOptions.js';
import { getBscPatronAccount, updateBscPatronAccount } from '@/lib/bsc/patronAccount.js';
import {
	buyPatronDye,
	formatPatronDyeShop,
	loadPatronDyesForUser,
	undyePatronItem,
	usePatronDye
} from '@/lib/bsc/patronDyeShop.js';
import { PATRON_DYE_ITEM_IDS, PATRON_DYES, patronDyeById, resolveItemFromInput } from '@/lib/bsc/patronDyes.js';
import { sanitizePatronFlair } from '@/lib/bsc/patronFlair.js';
import { loyaltyBadgeLabel } from '@/lib/bsc/patronLoyalty.js';
import { performBscPatronGift, triggerBscDoubleLoot } from '@/lib/bsc/patronPerks.js';
import { generatePatronProfileCard, setFavoritePatronPet } from '@/lib/bsc/patronProfile.js';
import { renderPatronDyeGrid } from '@/lib/bsc/renderPatronDyeGrid.js';
import { getBscPatronOverride } from '@/lib/bsc/patronStore.js';
import {
	bscPatronLevelFromBits,
	bscPatronTierByLevel,
	formatBscPatronOverview,
	planBscPatronGift
} from '@/lib/bsc/patronTiers.js';
import { parsePatronTitle } from '@/lib/bsc/patronTitles.js';
import { patreonUrl } from '@/lib/patreonLink.js';
import { patronMsg } from '@/lib/util/smallUtils.js';

const DYE_SUBSCRIBE_MSG = `Patron dyes are for Pup and up. Subscribe at ${patreonUrl()}`;

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

async function dyedItemAutocomplete(value: string | undefined, user: MUser) {
	const q = (value ?? '').toLowerCase();
	const applied = await loadPatronDyesForUser(user.id);
	const choices: { name: string; value: string }[] = [];
	for (const row of applied) {
		const item = resolveItemFromInput(String(row.itemID));
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

function isDyeItem(itemID: number) {
	return Boolean(patronDyeById(itemID) || PATRON_DYE_ITEM_IDS.has(itemID));
}

async function dyeTargetAutocomplete(value: string | undefined, user: MUser) {
	const q = (value ?? '').toLowerCase();
	const applied = await loadPatronDyesForUser(user.id);
	const choices: { name: string; value: string }[] = [];
	const seen = new Set<number>();

	const add = (itemID: number, name: string, suffix?: string) => {
		if (seen.has(itemID) || isDyeItem(itemID)) return;
		if (q && !name.toLowerCase().includes(q) && String(itemID) !== q) return;
		seen.add(itemID);
		choices.push({ name: suffix ? `${name} (${suffix})` : name, value: String(itemID) });
	};

	for (const row of applied) {
		const item = resolveItemFromInput(String(row.itemID));
		add(row.itemID, item?.name ?? `Item ${row.itemID}`, 'dyed');
		if (choices.length >= 25) return choices;
	}
	for (const [item, qty] of user.bank.items()) {
		add(item.id, item.name, String(qty));
		if (choices.length >= 25) return choices;
	}
	if (q) {
		for (const item of itemArr) {
			add(item.id, item.name);
			if (choices.length >= 25) break;
		}
	}
	return choices;
}

export const patronCommand = defineCommand({
	name: 'patron',
	description: 'Bark School Corgo patron tiers, cosmetics, dyes, gifts, and double loot.',
	attributes: {
		examples: [
			'/patron info',
			'/patron title title:Massive Hotdog',
			'/patron flair text:Back from a treat run',
			'/patron profile',
			'/patron dyes buy:Biscuit',
			'/patron dye item:Bandos chestplate dye:Fetch',
			'/patron dyeclaim item:Bandos chestplate',
			'/patron dye_preview item:Bandos chestplate',
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
					description: 'Your custom title (2-24 characters), or clear.',
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
			description: 'Use or update a patron dye on an item. You do not need to own the item. Pup and up.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The item to dye. You do not need to have it in your bank.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => dyeTargetAutocomplete(value, user)
				},
				{
					type: 'String',
					name: 'dye',
					description: 'The dye to use, or the dye already applied if you are changing colours.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => {
						const q = (value ?? '').toLowerCase();
						const applied = await loadPatronDyesForUser(user.id);
						const appliedKeys = new Set(applied.map(row => row.dyeKey));
						return PATRON_DYES.filter(dye => user.bank.amount(dye.itemID) > 0 || appliedKeys.has(dye.key))
							.filter(dye => !q || dye.name.toLowerCase().includes(q) || dye.key.includes(q))
							.map(dye => {
								const owned = user.bank.amount(dye.itemID);
								const suffix = owned > 0 ? `${owned} in bank` : 'already applied';
								return { name: `${dye.name} (${suffix})`, value: dye.key };
							});
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
			name: 'dyeclaim',
			description: 'Claim a used dye back, even if you no longer have the item. Pup and up.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The dyed item record to claim the bottle back from.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => dyedItemAutocomplete(value, user)
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'dye_preview',
			description: 'Preview all five patron dyes on an item. Free, and open to everyone.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The item to preview. You do not need to own it.',
					required: true,
					autocomplete: async ({ value }: StringAutoComplete) => {
						const q = (value ?? '').toLowerCase();
						return itemArr
							.filter(item => !q || item.key.includes(q) || String(item.id) === q)
							.slice(0, 25)
							.map(item => ({ name: item.name, value: String(item.id) }));
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'undye',
			description: 'Remove a patron dye from an item and return the dye to your bank. Same as /patron dyeclaim.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The dyed item to restore.',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => dyedItemAutocomplete(value, user)
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'double_loot',
			description: 'Start your weekly server double loot. Pack Leader and Biggest of Dogs.'
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
			if (!parsed.ok) return parsed.message;
			if (parsed.title === null) {
				await updateBscPatronAccount(user.id, { title: null });
				return 'Your patron title was cleared.';
			}
			await updateBscPatronAccount(user.id, { title: parsed.title });
			return `Your patron title is now ${parsed.title}.`;
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
		if (options.dye_preview) {
			const item = resolveItemFromInput(options.dye_preview.item);
			if (!item) return "That's not a valid item.";
			const buffer = await renderPatronDyeGrid({ item });
			return {
				content: `Dye previews for ${item.name}. Golden Corgo: any glow colour, any dye colour, sparkle on/off.`,
				files: [{ buffer, name: 'dye-preview.png' }]
			};
		}
		if (options.dye) {
			const isPatron = (await user.fetchPerkTier()) >= PerkTier.Two;
			const ownsDye = PATRON_DYES.some(dye => user.bank.amount(dye.itemID) > 0);
			if (!isPatron && !ownsDye) {
				const applied = await loadPatronDyesForUser(user.id);
				if (applied.length === 0) return DYE_SUBSCRIBE_MSG;
			}
			return usePatronDye(user, options.dye.dye, options.dye.item, options.dye.mode, {
				glowHex: options.dye.glow_hex,
				recolourHex: options.dye.recolour_hex,
				sparkle: options.dye.sparkle
			});
		}
		if (options.dyeclaim) {
			const isPatron = (await user.fetchPerkTier()) >= PerkTier.Two;
			if (!isPatron) {
				const applied = await loadPatronDyesForUser(user.id);
				if (applied.length === 0) return DYE_SUBSCRIBE_MSG;
			}
			return undyePatronItem(user, options.dyeclaim.item);
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
