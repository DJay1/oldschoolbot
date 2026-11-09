import { Items, toKMB } from 'oldschooljs';
import { medianSorted } from 'simple-statistics';

import { itemOption } from '@/discord/index.js';
import { marketPricemap } from '@/lib/cache.js';
import { type DcLookupLine, type DcLookupSection, renderDcLookupImage } from '@/lib/canvas/dcLookupImage.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { getDiscontinuedItemPerks, getDiscontinuedItemStatus, isDiscontinuedItem } from '@/lib/discontinuedItems.js';
import { countItemCopies } from '@/lib/util/countItemCopies.js';
import { type DiscontinuedSale, findSaleAnomalies } from '@/lib/util/saleAnomalies.js';

const SALES_TO_CHECK = 500;
const FLAGGED_SALES_SHOWN = 5;

function gp(amount: number) {
	return `${toKMB(amount)} (${amount.toLocaleString()} GP)`;
}

function shortDate(date: Date) {
	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const dcLookupCommand = defineCommand({
	name: 'dclookup',
	description: 'Look up the market price of a discontinued item.',
	options: [
		{
			...itemOption(item => isDiscontinuedItem(item.id) && !item.customItemData?.isSecret),
			description: 'The discontinued item to look up.',
			required: true
		}
	],
	run: async ({ options, interaction, user }) => {
		const item = Items.getItem(options.item);
		if (!item || item.customItemData?.isSecret || !isDiscontinuedItem(item.id)) {
			return "That isn't a discontinued item.";
		}

		await interaction.defer();

		const rawSales = await prisma.gETransaction.findMany({
			where: {
				sell_listing: {
					item_id: item.id
				}
			},
			orderBy: {
				created_at: 'desc'
			},
			select: {
				created_at: true,
				quantity_bought: true,
				price_per_item_before_tax: true,
				sell_listing: { select: { user_id: true } },
				buy_listing: { select: { user_id: true } }
			},
			take: SALES_TO_CHECK
		});

		const sales: DiscontinuedSale[] = rawSales.map(sale => ({
			price: Number(sale.price_per_item_before_tax),
			quantity: sale.quantity_bought,
			date: sale.created_at,
			sellerID: sale.sell_listing.user_id,
			buyerID: sale.buy_listing.user_id
		}));

		const status = getDiscontinuedItemStatus(item.id);
		const copies = await countItemCopies(item.id);
		const copyParts = [
			`${copies.inBanks.toLocaleString()} in banks`,
			`${copies.equipped.toLocaleString()} equipped`
		];
		if (copies.onGrandExchange > 0) copyParts.push(`${copies.onGrandExchange.toLocaleString()} on the GE`);

		const summary: DcLookupLine[] = [
			{
				text: `Status: ${status}`,
				color: status === 'Unreleased' ? OSRSCanvas.COLORS.RED : OSRSCanvas.COLORS.GREEN
			},
			{
				text: `Copies: ${copies.total.toLocaleString()} (${copyParts.join(', ')})`,
				color: OSRSCanvas.COLORS.YELLOW
			}
		];

		const sections: DcLookupSection[] = [];

		const perks = getDiscontinuedItemPerks(item.id);
		if (perks.length > 0) {
			sections.push({ title: 'Perk / Usage', lines: perks.map(perk => ({ text: perk, bullet: true })) });
		}

		const marketData = marketPricemap.get(item.id);
		const priceLines: DcLookupLine[] = [
			{
				text: marketData
					? `Market price: ${gp(marketData.guidePrice)}`
					: 'Market price: not enough recent sales',
				color: marketData ? OSRSCanvas.COLORS.YELLOW : undefined
			}
		];

		const traderNotes: string[] = [];

		if (sales.length === 0) {
			priceLines.push({ text: 'Never sold on the Grand Exchange.' });
			sections.push({ title: 'Grand Exchange', lines: priceLines });
		} else {
			const anomalies = findSaleAnomalies(sales);
			const cleanSales = sales.filter((_, index) => !anomalies.has(index));
			const totalSold = sales.reduce((sum, sale) => sum + sale.quantity, 0);
			const salesWord = sales.length === 1 ? 'sale' : 'sales';
			const limitNote = sales.length === SALES_TO_CHECK ? ` (latest ${SALES_TO_CHECK} checked)` : '';

			if (cleanSales.length === 0) {
				priceLines.push({
					text: 'Every sale is flagged, so there is no reliable price.',
					color: OSRSCanvas.COLORS.RED
				});
			} else {
				const prices = cleanSales.map(sale => sale.price).sort((a, b) => a - b);
				const lastSale = cleanSales[0];
				priceLines.push(
					{ text: `Last sold: ${gp(lastSale.price)} each, ${shortDate(lastSale.date)}` },
					{ text: `Median sale price: ${gp(Math.round(medianSorted(prices)))}` },
					{ text: `Lowest / highest: ${toKMB(prices[0])} / ${toKMB(prices[prices.length - 1])}` }
				);
			}
			priceLines.push({
				text: `Total sold: ${totalSold.toLocaleString()} across ${sales.length.toLocaleString()} ${salesWord}${limitNote}`
			});
			sections.push({ title: 'Grand Exchange', lines: priceLines });

			if (anomalies.size > 0) {
				const flagged = [...anomalies.entries()].slice(0, FLAGGED_SALES_SHOWN);
				const flaggedLines: DcLookupLine[] = flagged.map(([index, reasons]) => {
					const sale = sales[index];
					return {
						text: `${toKMB(sale.price)} each, ${shortDate(sale.date)}: ${reasons.join(', ')}`,
						bullet: true
					};
				});
				if (anomalies.size > FLAGGED_SALES_SHOWN) {
					flaggedLines.push({ text: `and ${anomalies.size - FLAGGED_SALES_SHOWN} more`, bullet: true });
				}
				sections.push({
					title: `${anomalies.size} ${anomalies.size === 1 ? 'sale' : 'sales'} flagged (left out of prices)`,
					titleColor: OSRSCanvas.COLORS.RED,
					lines: flaggedLines
				});

				if (user.isAdmin()) {
					for (const [index] of flagged) {
						const sale = sales[index];
						if (!sale.sellerID || !sale.buyerID) continue;
						traderNotes.push(
							`${toKMB(sale.price)} on ${shortDate(sale.date)}: <@${sale.sellerID}> sold to <@${sale.buyerID}>`
						);
					}
				}
			}
		}

		const image = await renderDcLookupImage({ itemID: item.id, itemName: item.name, summary, sections });

		return {
			content: traderNotes.length > 0 ? `**Flagged sales (admin only):**\n${traderNotes.join('\n')}` : undefined,
			files: [{ name: 'dclookup.png', buffer: image }],
			allowedMentions: { users: [] }
		};
	}
});
