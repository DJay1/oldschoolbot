import { EmbedBuilder } from '@oldschoolgg/discord';
import { formatDuration, stringMatches } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank, Items } from 'oldschooljs';

import { applyBuyCostSellFloor } from '@/lib/util/buySellFloor.js';

export const GF_COST_GP = 1_000_000;
export const GF_ITEM_ID = 1842;
export const GF_GIF_URL =
	'https://static2.klipy.com/ii/d6b0ce929193df3c242ac34b5654d2ce/0d/9b/eAfdqa38.gif';

const GF_FUNNY_LINE = 'You spent 1m GP on a girlfriend. She arrived in a barrel. No refunds.';

export function isGfBuyName(name: string): boolean {
	return stringMatches(name, 'gf') || stringMatches(name, 'girlfriend');
}

export function gfQuantityError(quantity: number | null): string | null {
	if (quantity !== null && quantity !== 1) {
		return 'You can only buy gf in a quantity of 1.';
	}
	return null;
}

export async function buyGf(interaction: OSInteraction, quantity: number | null): CommandResponse {
	const { user } = interaction;
	const qtyError = gfQuantityError(quantity);
	if (qtyError) return qtyError;

	const remainingSeconds = await Cache.getRatelimitTTL(user.id, 'buy_gf');
	if (remainingSeconds > 0) {
		return `You can only buy gf once every 24 hours. You can buy again in ${formatDuration(remainingSeconds * 1000)}.`;
	}

	const item = Items.getOrThrow(GF_ITEM_ID);
	const loot = new Bank().add(item.id, 1);
	const costGp = applyBuyCostSellFloor(GF_COST_GP, loot);
	const cost = new Bank().add('Coins', costGp);

	if (!user.owns(cost)) {
		return `You don't have the required items to purchase this. You need: ${cost}.`;
	}

	await interaction.confirmation(`${user}, please confirm that you want to buy **${loot}** for: ${cost}.`);

	const ratelimit = await Cache.tryRatelimit(user.id, 'buy_gf');
	if (!ratelimit.success) {
		return `You can only buy gf once every 24 hours. You can buy again in ${formatDuration(ratelimit.timeRemainingMs)}.`;
	}

	try {
		await user.transactItems({
			itemsToAdd: loot,
			collectionLog: true,
			itemsToRemove: cost
		});
	} catch (err) {
		await Cache.resetRatelimit(user.id, 'buy_gf');
		throw err;
	}

	let costBankExcludingGP: Bank | undefined = cost.clone().remove('Coins', cost.amount('Coins'));
	if (costBankExcludingGP.length === 0) costBankExcludingGP = undefined;

	const currentStats = await user.fetchStats();
	await Promise.all([
		ClientSettings.updateBankSetting('buy_cost_bank', cost),
		ClientSettings.updateBankSetting('buy_loot_bank', loot),
		user.statsUpdate({
			buy_cost_bank: cost
				.clone()
				.add(currentStats.buy_cost_bank as ItemBank)
				.toJSON(),
			buy_loot_bank: loot
				.clone()
				.add(currentStats.buy_loot_bank as ItemBank)
				.toJSON()
		}),
		prisma.buyCommandTransaction.create({
			data: {
				user_id: BigInt(user.id),
				cost_gp: cost.amount('Coins'),
				cost_bank_excluding_gp: costBankExcludingGP,
				loot_bank: loot.toJSON()
			},
			select: { id: true }
		})
	]);

	return {
		content: GF_FUNNY_LINE,
		embeds: [new EmbedBuilder().setImage(GF_GIF_URL)]
	};
}