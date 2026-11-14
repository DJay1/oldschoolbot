import { Bank, type ItemBank } from 'oldschooljs';

import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { unqueuedTransactItems } from '@/lib/util/transactItemsFromBank.js';
import { userQueueFn } from '@/lib/util/userQueues.js';
import {
	ctDayKey,
	formatOfferReply,
	GOBBLE_STREAK_OFFERS,
	GOBBLES_IDS,
	GOBBLES_PITY_OFFERS,
	hasHarvestBlessing,
	isThanksgivingActive,
	OFFER_RATES,
	offersFromScores,
	rollThanksgivingOffers,
	type ThanksgivingRng
} from './core.js';
import { ThanksgivingItem } from './items.js';

const ready = { done: false };

async function ensureDailyTable() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_thanksgiving_daily (
			user_id text NOT NULL,
			day text NOT NULL,
			offers integer NOT NULL DEFAULT 0,
			PRIMARY KEY (user_id, day)
		)
	`);
	ready.done = true;
}

async function offersToday(userID: string, day: string): Promise<number> {
	await ensureDailyTable();
	const rows = await prisma.$queryRaw<{ offers: number }[]>`
		SELECT offers FROM bsc_thanksgiving_daily WHERE user_id = ${userID} AND day = ${day}
	`;
	return rows[0]?.offers ?? 0;
}

async function addOffersToday(userID: string, day: string, amount: number) {
	await ensureDailyTable();
	await prisma.$executeRaw`
		INSERT INTO bsc_thanksgiving_daily (user_id, day, offers)
		VALUES (${userID}, ${day}, ${amount})
		ON CONFLICT (user_id, day) DO UPDATE SET offers = bsc_thanksgiving_daily.offers + EXCLUDED.offers
	`;
}

function hasHadGobbles(user: MUser): boolean {
	return GOBBLES_IDS.some(id => user.cl.has(id) || user.allItemsOwned.has(id));
}

/**
 * Hand in Bountiful cornucopias. Runs inside the per-user queue: the cornucopias are
 * removed, the loot added, and the offer count saved in one transaction, so two offers
 * at the same time cannot spend the same cornucopia.
 */
export async function thanksgivingOffer(user: MUser, quantityInput: number | null | undefined, rng: ThanksgivingRng) {
	if (!isThanksgivingActive()) return 'The Straw Hat Harvest is not running right now.';
	// No per-command cap: you can offer as many as you own. Rolls are a simple loop (a few hundred ms
	// for 100k offers), the reply text is a fixed size, and the loot image only grows by item types.
	const requested = Math.floor(quantityInput ?? 1);
	if (!Number.isSafeInteger(requested) || requested < 1) return 'Offer at least 1 Bountiful cornucopia.';
	const quantity = requested;

	return userQueueFn(user.id, async () => {
		await user.sync();
		const owned = user.bank.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA);
		if (owned < quantity) {
			return owned === 0
				? 'You need a Bountiful cornucopia. Make one with `/create item:Bountiful cornucopia` (5 Harvest bundles + 1 Wicker basket).'
				: `You only have ${owned}x Bountiful cornucopia.`;
		}

		const stats = await user.fetchStats();
		const scores = new Bank((stats.openable_scores ?? {}) as ItemBank);
		const offersBefore = offersFromScores(scores.toJSON());
		const day = ctDayKey();
		const todayBefore = await offersToday(user.id, day);
		const blessing = hasHarvestBlessing(user);
		const hadGobblesBefore = hasHadGobbles(user);

		const result = rollThanksgivingOffers({
			quantity,
			offersBefore,
			offersTodayBefore: todayBefore,
			hasHadGobbles: hadGobblesBefore,
			blessing,
			rng
		});

		const previousCL = user.cl.clone();
		const newScores = scores.clone().add(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA, quantity);
		const { itemsAdded } = await unqueuedTransactItems({
			user,
			itemsToRemove: new Bank().add(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA, quantity),
			itemsToAdd: result.loot,
			collectionLog: true,
			statsUpdates: { openable_scores: newScores.toJSON() }
		});
		// Streak counter only. If this write fails the loot is already safe; worst case the streak is one behind.
		await addOffersToday(user.id, day, quantity).catch(err => Logging.logError(err as Error));

		const offersAfter = offersBefore + quantity;
		const content = formatOfferReply({
			result,
			quantity,
			blessing,
			hadGobblesBefore,
			offersAfter,
			offersTodayAfter: todayBefore + quantity
		});
		const image = await makeBankImage({
			bank: itemsAdded,
			title: `Loot from ${quantity}x Bountiful cornucopia`,
			user,
			previousCL
		});
		return { content, files: [image] };
	});
}

export async function thanksgivingStatus(user: MUser): Promise<string> {
	const active = isThanksgivingActive();
	const stats = await user.fetchStats();
	const offers = offersFromScores((stats.openable_scores ?? {}) as ItemBank);
	const today = await offersToday(user.id, ctDayKey()).catch(() => 0);
	const bank = user.bank;
	const hadGobbles = hasHadGobbles(user);
	const lines = [
		`**The Straw Hat Harvest** is ${active ? 'running' : 'not running right now'}.`,
		`Harvest bundles: ${bank.amount(ThanksgivingItem.HARVEST_BUNDLE)}, Wicker baskets: ${bank.amount(ThanksgivingItem.WICKER_BASKET)}, Bountiful cornucopias: ${bank.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA)}`,
		`Offers made: ${offers.toLocaleString()}`,
		today >= GOBBLE_STREAK_OFFERS
			? `Gobble Streak: active today (${today} offers). Rare chances are 15% better until midnight CT.`
			: `Gobble Streak: ${today}/${GOBBLE_STREAK_OFFERS} offers today (CT).`,
		hadGobbles
			? 'Gobbles: ✅ you have had Gobbles.'
			: `Gobbles guarantee: ${Math.min(offers, GOBBLES_PITY_OFFERS)}/${GOBBLES_PITY_OFFERS} offers.`,
		`Harvest Blessing (Cornucopia in bank): ${hasHarvestBlessing(user) ? 'yes' : 'no'}`,
		`Rates per offer: Paint box 1/${OFFER_RATES.paintBox}, Cornucopia 1/${OFFER_RATES.cornucopia}, Pilgrim hat 1/${OFFER_RATES.pilgrimHat}, Straw hat 1/${OFFER_RATES.strawHat}, Gobbles 1/${OFFER_RATES.gobbles}.`
	];
	return lines.join('\n');
}
