import type { ItemBank } from 'oldschooljs';

import { BADGE_EMOJI_NAMES, badgeEmoji } from '@/lib/badges/badgeEmojis.js';
import { CUSTOM_PRICE_CACHE } from '@/lib/cache.js';
import { syncCollectionLogSlotTable } from '@/lib/collection-log/databaseCl.js';
import { globalConfig } from '@/lib/constants.js';
import { GrandExchange } from '@/lib/grandExchange.js';
import { cacheGEPrices } from '@/lib/marketPrices.js';

async function updateBadgeTable() {
	const badgesInDb = await prisma.badges.findMany();
	// Legacy catalog only; nothing renders from badges.text. Icons come from badgeEmojis.ts.
	for (const _id of Object.keys(BADGE_EMOJI_NAMES)) {
		const id = Number(_id);
		const emojiString = badgeEmoji(id);
		if (!badgesInDb.find(b => b.id === id)) {
			await prisma.badges.create({
				data: {
					id,
					text: emojiString
				}
			});
		}
	}
}

export async function syncCustomPrices() {
	const clientData = await ClientSettings.fetch({ custom_prices: true });
	for (const [key, value] of Object.entries(clientData.custom_prices as ItemBank)) {
		CUSTOM_PRICE_CACHE.set(Number(key), Number(value));
	}
}

export const preStartup = async () => {
	await prisma.clientStorage.upsert({
		where: { id: globalConfig.clientID },
		create: { id: globalConfig.clientID },
		update: {},
		select: { id: true }
	});

	await Promise.all([
		syncCustomPrices(),
		GrandExchange.init(),
		cacheGEPrices(),
		syncCollectionLogSlotTable(),
		updateBadgeTable()
	]);
};
