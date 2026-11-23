import { Time } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank } from 'oldschooljs';

import { announceThanksgivingPets, announceToRareChannel } from '@/lib/bsc/rareAnnouncements.js';
import { resolveSeasonalEvent } from '@/lib/events/registry.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { unqueuedTransactItems } from '@/lib/util/transactItemsFromBank.js';
import { userQueueFn } from '@/lib/util/userQueues.js';
import { withThanksgivingMakeButtons } from './buttons.js';
import {
	ctDayKey,
	formatGobbleStreakStatusLine,
	formatHarvestBlessingStatusLine,
	formatLaboonFishingRateLine,
	formatOfferReply,
	formatThanksgivingBaseRatesLine,
	formatThanksgivingTripPartsRateLine,
	GOBBLES_IDS,
	GOBBLES_PITY_OFFERS,
	hasHarvestBlessing,
	isThanksgivingActive,
	offersFromScores,
	parseOfferQuantity,
	rollThanksgivingOffers,
	type ThanksgivingRng
} from './core.js';
import {
	activeHarvestFeast,
	HARVEST_FEAST_MAX_TOTAL_MS,
	HARVEST_FEAST_SUCCESS_ONE_IN,
	harvestFeastAnnouncement,
	harvestFeastIsFull,
	harvestFeastName,
	harvestFeastStatusLine,
	rollTurkeyOffer,
	saveHarvestFeast
} from './feast.js';
import { ThanksgivingItem } from './items.js';
import {
	formatCornucopiaCanMakeLine,
	formatCornucopiaOfferEmpty,
	formatThanksgivingPartsLine,
	formatThanksgivingWindowLine
} from './make.js';

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
export async function thanksgivingOffer(
	user: MUser,
	quantityInput: string | number | null | undefined,
	rng: ThanksgivingRng,
	opts?: { alreadyQueued?: boolean }
) {
	if (!isThanksgivingActive()) return 'The Straw Hat Harvest is not running right now.';
	// No per-command cap: you can offer as many as you own. Rolls are a simple loop (a few hundred ms
	// for 100k offers), the reply text is a fixed size, and the loot image only grows by item types.
	const requested = parseOfferQuantity(quantityInput);
	if (requested === null) return "Quantity must be a whole number of at least 1, or 'all'.";

	const run = async () => {
		await user.sync();
		// 'all' is resolved inside the queue after sync, so it is exactly what the bank holds right now.
		const owned = user.bank.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA);
		if (owned === 0) {
			return withThanksgivingMakeButtons(user, formatCornucopiaOfferEmpty(user.bank), { includeOffer: true });
		}
		const quantity = requested === 'all' ? owned : requested;
		if (owned < quantity) {
			return `You only have ${owned}x Bountiful cornucopia. Leave quantity blank or use 'all' to offer them all.`;
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

		// Cornucopia (Harvest Blessing item): one announcement per offer command, however many dropped.
		const cornucopias = result.loot.amount(ThanksgivingItem.CORNUCOPIA_2021);
		if (cornucopias > 0) {
			void announceToRareChannel(
				`🌽 ${user.usernameOrMention} just received ${cornucopias > 1 ? `${cornucopias}x ` : ''}**Cornucopia** from a Straw Hat Harvest offer!`
			);
		}

		// Every event pet from this offer, in one message.
		void announceThanksgivingPets(
			user,
			result.loot,
			previousCL.clone().add(result.loot),
			'from a Straw Hat Harvest offer'
		);

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
		return withThanksgivingMakeButtons(user, { content, files: [image] }, { includeOffer: true });
	};
	if (opts?.alreadyQueued) return run();
	return userQueueFn(user.id, run);
}

/**
 * Offer one Harvest turkey. It is always used up. 1 in 3: starts a 2x loot or 2x XP feast, or adds
 * 10-30 minutes to the running one (same kind), capped at 3 hours left. The turkey is removed first in
 * its own transaction; if saving the feast then fails, the turkey is given back.
 */
export async function thanksgivingFeast(user: MUser, rng: ThanksgivingRng) {
	if (!isThanksgivingActive()) return 'The Straw Hat Harvest is not running right now.';
	return userQueueFn(user.id, async () => {
		await user.sync();
		if (!user.bank.has(ThanksgivingItem.HARVEST_TURKEY)) {
			return 'You need a Harvest turkey. They are a rare roll from `/thanksgiving offer` (about 1 in 50 offers).';
		}
		const now = Date.now();
		const active = activeHarvestFeast(user.id, now);
		if (active && harvestFeastIsFull(active, now)) {
			return `Your ${harvestFeastName(active.kind)} feast already has the maximum ${HARVEST_FEAST_MAX_TOTAL_MS / Time.Hour} hours left. Keep your Harvest turkey for later.`;
		}
		const turkey = new Bank().add(ThanksgivingItem.HARVEST_TURKEY, 1);
		await unqueuedTransactItems({ user, itemsToRemove: turkey });

		const result = rollTurkeyOffer(rng, active, now);
		if (result.outcome === 'none') {
			return `🦃 You offer a Harvest turkey to the harvest... the Harvest turkey was eaten, but no Harvest feast this time. (Each Harvest turkey has a 1 in ${HARVEST_FEAST_SUCCESS_ONE_IN} chance.)`;
		}
		try {
			await saveHarvestFeast(user.id, result.feast);
		} catch (err) {
			Logging.logError(err as Error, { user_id: user.id, source: 'thanksgivingFeast' });
			await unqueuedTransactItems({ user, itemsToAdd: turkey, collectionLog: false });
			return 'The feast could not be saved, so your Harvest turkey was given back. Please try again.';
		}

		// Only successful turkeys are announced (each is used up, so this cannot be spammed).
		const announcement = harvestFeastAnnouncement(user.usernameOrMention, result);
		if (announcement) void announceToRareChannel(announcement);

		const feast = result.feast;
		const added = Math.max(1, Math.round(result.addedMs / Time.Minute));
		const ends = `<t:${Math.floor(feast.endMs / 1000)}:R>`;
		const lines = [
			result.outcome === 'new'
				? `🦃 You offer a Harvest turkey to the harvest... **Harvest feast: ${harvestFeastName(feast.kind)}** for **${added} minutes** (ends ${ends}).`
				: `🦃 You offer a Harvest turkey to the harvest... **+${added} minutes** added to your **${harvestFeastName(feast.kind)}** feast (ends ${ends}).`,
			feast.kind === 'loot'
				? 'Trips get 2x loot for the part of the trip inside the feast (event items, pets and untradeables are not doubled; does not stack with Double Loot).'
				: 'Trips get 2x XP for the part of the trip inside the feast (does not stack with Double XP).'
		];
		if (result.outcome === 'extended' && feast.endMs - now >= HARVEST_FEAST_MAX_TOTAL_MS - Time.Minute) {
			lines.push(`Your feast is now at the ${HARVEST_FEAST_MAX_TOTAL_MS / Time.Hour} hour maximum.`);
		}
		return lines.join('\n');
	});
}

export async function thanksgivingStatus(user: MUser) {
	const active = isThanksgivingActive();
	const stats = await user.fetchStats();
	const offers = offersFromScores((stats.openable_scores ?? {}) as ItemBank);
	const today = await offersToday(user.id, ctDayKey()).catch(() => 0);
	const bank = user.bank;
	const hadGobbles = hasHadGobbles(user);
	const window = resolveSeasonalEvent('thanksgiving');
	const lines = [
		formatThanksgivingWindowLine(active, window.start, window.end),
		formatThanksgivingPartsLine(bank),
		`-# ${formatCornucopiaCanMakeLine(bank)}`,
		`**Offers:** ${offers.toLocaleString()}`,
		formatGobbleStreakStatusLine(today),
		hadGobbles
			? '**Gobbles:** ✅ you have had Gobbles'
			: `**Gobbles guarantee:** ${Math.min(offers, GOBBLES_PITY_OFFERS)}/${GOBBLES_PITY_OFFERS} offers`,
		formatHarvestBlessingStatusLine(hasHarvestBlessing(user)),
		`**Harvest turkey:** ${bank.amount(ThanksgivingItem.HARVEST_TURKEY).toLocaleString()}`,
		harvestFeastStatusLine(user.id),
		formatThanksgivingTripPartsRateLine(),
		formatThanksgivingBaseRatesLine(),
		formatLaboonFishingRateLine()
	];
	return withThanksgivingMakeButtons(user, lines.join('\n'), { includeOffer: active });
}
