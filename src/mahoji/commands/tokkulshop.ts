import { formatDuration, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank, Monsters } from 'oldschooljs';

import { activity_type_enum } from '@/prisma/main/enums.js';
import { tokkulShopDailyLimitFor, tokkulShopLimitName } from '@/lib/data/buyables/skillingSupplyLimits.js';
import { TokkulShopItems, tokkulShopBuyDuration, tokkulShopMaxBuyable } from '@/lib/data/buyables/tokkulBuyables.js';
import {
	tokkulShopBlockedMessage,
	tokkulShopDiaryNote,
	tokkulShopJadNote,
	tokkulShopTooLongMessage
} from '@/lib/data/buyables/tokkulShopMessages.js';
import type { TokkulShopOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { runWithDailyLimit } from '@/lib/util/runWithBuyDailyLimit.js';

const { TzTokJad } = Monsters;

const TIME_PER_50 = Time.Second;
const TIME_PER_1 = TIME_PER_50 / 50;

export const tksCommand = defineCommand({
	name: 'tokkulshop',
	description: 'Buy or sell items from the Tzhaar shops.',
	attributes: {
		requiresMinion: true,
		categoryFlags: ['minion'],
		examples: ['/tokkulshop buy Obsidian platebody', '/tokkulshop sell Chaos rune 5000']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'buy',
			description: 'Buy an item in exchange for tokkul',
			options: [
				{
					name: 'name',
					description: 'The item you want to purchase.',
					type: 'String',
					required: true,
					autocomplete: async ({ value }: StringAutoComplete) => {
						return TokkulShopItems.filter(i =>
							!value ? true : i.name.toLowerCase().includes(value.toLowerCase())
						)
							.filter(i => i.tokkulCost! > 0)
							.map(i => ({ name: i.name, value: i.name }));
					}
				},
				{
					name: 'quantity',
					description: 'The quantity you want to purchase.',
					type: 'Integer',
					required: true,
					min_value: 1,
					max_value: 100_000
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'sell',
			description: 'Sell an item in exchange for tokkul',
			options: [
				{
					name: 'name',
					description: 'The item you want to sell.',
					type: 'String',
					required: true,
					autocomplete: async ({ value }: StringAutoComplete) => {
						return TokkulShopItems.filter(i =>
							!value ? true : i.name.toLowerCase().includes(value.toLowerCase())
						)
							.filter(i => i.tokkulReturn! > 0)
							.map(i => ({ name: i.name, value: i.name }));
					}
				},
				{
					name: 'quantity',
					description: 'The quantity you want to sell.',
					type: 'Integer',
					required: true,
					min_value: 1,
					max_value: 100_000
				}
			]
		}
	],
	run: async ({ channelId, options, interaction, user }) => {
		if (await user.minionIsBusy()) return `${user.minionName} is currently busy and cannot go to the Tzhaar shops.`;

		const hasKaramjaDiary = user.hasDiary('karamja.easy');
		const item = TokkulShopItems.find(i => stringMatches(i.name, options.buy?.name ?? options.sell?.name ?? ''));
		const hasKilledJad: boolean = (await user.getKC(TzTokJad.id)) >= 1;
		const isIronman = !!user.user.minion_ironman;

		if (!item) return "That's not a valid item.";

		if (item.requireFireCape && !hasKilledJad) {
			return `You are not worthy JalYt. Before you can buy/sell ${item.name}, you need to have defeated the mighty TzTok-Jad! Kill TzTok-Jad once with \`/activities fight_caves\`.`;
		}

		// User bank, maxTripLength, quantity given
		const { bank } = user;
		const maxTripLength = await user.calcMaxTripLength(activity_type_enum.TokkulShop);
		const quantity = options.buy?.quantity ?? options.sell?.quantity ?? 1;
		const cost = new Bank();
		const loot = new Bank();

		const buyer = { hasKilledJad, isIronman };
		let duration: number;

		// Calculate tokkul cost for buying or selling
		if (options.buy) {
			// Uses the stock that applies to this player (TzHaar-Hur-Rin's after a TzTok-Jad kill), and flat gem times.
			const blocked = tokkulShopBlockedMessage(item, buyer);
			const buyDuration = tokkulShopBuyDuration(item, buyer, quantity);
			if (blocked || buyDuration === null || !item.diaryTokkulCost || !item.tokkulCost) {
				return blocked ?? "You can't buy this item.";
			}
			duration = buyDuration;
			const tokkulCost = (hasKaramjaDiary ? item.diaryTokkulCost : item.tokkulCost) * quantity;
			cost.add('Tokkul', tokkulCost);
			loot.add(item.itemID, quantity);
		} else {
			if (!item.diaryTokkulReturn || !item.tokkulReturn) return "You can't sell this item.";
			duration = quantity * TIME_PER_1;
			const tokkulReturn = (hasKaramjaDiary ? item.diaryTokkulReturn : item.tokkulReturn) * quantity;
			loot.add('Tokkul', tokkulReturn);
			cost.add(item.itemID, quantity);
		}
		// If the user doesn't have the items or tokkul
		if (!bank.has(cost)) return `You don't own ${cost}.`;
		const action = options.buy ? 'buy' : 'sell';

		// Calculate the max amount of items the user can buy or sell
		const maxCanTransact = options.buy
			? tokkulShopMaxBuyable(item, buyer, maxTripLength)
			: Math.floor((maxTripLength / 1000) * 50);

		// If the duration of the trip is longer than the users max allowed trip, give the reason why and the max they can buy or sell
		if (duration > maxTripLength) {
			return tokkulShopTooLongMessage({ item, buyer, action, quantity, duration, maxTripLength, maxCanTransact });
		}

		// Extra info for the player: slower without a TzTok-Jad kill, and the Karamja diary price.
		const notes = [
			options.buy ? tokkulShopJadNote(item, buyer, quantity) : null,
			tokkulShopDiaryNote(item, action, hasKaramjaDiary)
		].filter(Boolean);
		const notesText = notes.length > 0 ? `\n\n${notes.join('\n')}` : '';

		// Ores and gems have a per-player daily cap (reserved before any Tokkul is taken, released if this fails or is cancelled).
		const dailyLimit = options.buy ? tokkulShopDailyLimitFor(item.name) : undefined;
		return runWithDailyLimit(
			user.id,
			tokkulShopLimitName(item.name),
			quantity,
			dailyLimit,
			async ({ commit }) => {
				// Confirmation the user has to accept before trip is sent
				await interaction.confirmation(
					`Are you sure you want to spend ${cost} to get ${loot}? The trip to ${action} them will take ${formatDuration(
						duration
					)}.${notesText}`
				);

				// Remove the cost, and update bank settings
				await user.transactItems({ itemsToRemove: cost });
				await ClientSettings.updateBankSetting('tks_cost', cost);

				// Tokkul shop activity
				await ActivityManager.startTrip<TokkulShopOptions>({
					userID: user.id,
					channelId,
					quantity: loot.items()[0][1],
					type: 'TokkulShop',
					duration,
					itemID: loot.items()[0][0].id
				});
				commit();

				// Trip start message
				return `${user.minionName} is now ${action}ing ${action === 'buy' ? loot : cost} ${
					action === 'buy' ? 'from' : 'to'
				} the Tzhaar Shops, in return for ${action === 'buy' ? cost : loot}. The trip will return in about ${formatTripDuration(user, duration)}.${notesText}`;
			},
			item.name
		);
	}
});
