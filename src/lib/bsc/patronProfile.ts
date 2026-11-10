import { PerkTier } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import { getBscPatronAccount, updateBscPatronAccount } from '@/lib/bsc/patronAccount.js';
import { earnedLoyaltyBadges, patronLoyaltySource } from '@/lib/bsc/patronLoyalty.js';
import { renderPatronProfileCard } from '@/lib/bsc/patronProfileCard.js';
import { type BscPatronTier, bscPatronTierFromBits } from '@/lib/bsc/patronTiers.js';
import { calcCLDetails } from '@/lib/data/Collections.js';
import { allPetIDs } from '@/lib/data/CollectionsExport.js';

const PET_ID_SET = new Set(allPetIDs);

export function ownedPatronPets(user: MUser): number[] {
	const ids: number[] = [];
	for (const id of PET_ID_SET) {
		if (user.cl.has(id) || user.bank.has(id) || user.user.minion_equippedPet === id) ids.push(id);
	}
	return ids;
}

export function parseFavoritePetInput(user: MUser, input: string | undefined): number | 'skip' | null {
	if (!input || /^skip|none|clear$/i.test(input.trim()))
		return input && /^skip|none|clear$/i.test(input.trim()) ? 'skip' : null;
	const trimmed = input.trim();
	const item = Items.getItem(trimmed) ?? Items.get(Number(trimmed));
	if (!item) return null;
	if (!PET_ID_SET.has(item.id)) return null;
	if (!ownedPatronPets(user).includes(item.id)) return null;
	return item.id;
}

export function defaultFavoritePet(user: MUser): number | null {
	if (user.user.minion_equippedPet && PET_ID_SET.has(user.user.minion_equippedPet)) {
		return user.user.minion_equippedPet;
	}
	return ownedPatronPets(user)[0] ?? null;
}

export function rarestCollectionItem(user: MUser): { id: number; name: string; price: number } | null {
	let best: { id: number; name: string; price: number } | null = null;
	for (const item of user.cl.items()) {
		const price = item[0].price ?? 0;
		if (!best || price > best.price) {
			best = { id: item[0].id, name: item[0].name, price };
		}
	}
	return best;
}

export async function setFavoritePatronPet(
	user: MUser,
	input: string | undefined
): Promise<{ petId: number | null; message: string }> {
	const parsed = parseFavoritePetInput(user, input);
	if (parsed === 'skip') {
		const fallback = defaultFavoritePet(user);
		await updateBscPatronAccount(user.id, { favoritePetId: fallback });
		const name = fallback ? (Items.get(fallback)?.name ?? 'your most-used pet') : 'no pet yet';
		return { petId: fallback, message: `Favorite pet skipped. The card will use ${name}.` };
	}
	if (parsed === null && input) {
		return { petId: null, message: 'Pick a pet you already own, or use skip.' };
	}
	if (typeof parsed === 'number') {
		await updateBscPatronAccount(user.id, { favoritePetId: parsed });
		return { petId: parsed, message: `Favorite pet set to ${Items.get(parsed)?.name}.` };
	}
	const account = await getBscPatronAccount(user.id);
	return { petId: account.favoritePetId, message: 'Favorite pet unchanged.' };
}

export async function generatePatronProfileCard(user: MUser): Promise<{ image: Buffer; caption: string }> {
	const account = await getBscPatronAccount(user.id);
	const tier = bscPatronTierFromBits(user.bitfield);
	const petId = account.favoritePetId;
	const rare = rarestCollectionItem(user);
	const cl = calcCLDetails(user);
	const months = Math.max(account.monthsTotal, account.monthsStreak);
	const isPatron = Boolean(tier);
	const source = patronLoyaltySource({
		userId: user.id,
		lastCreditedMonth: account.lastCreditedMonth,
		isPatron
	});
	const loyaltyBadges = earnedLoyaltyBadges({
		source,
		monthsTotal: account.monthsTotal,
		monthsStreak: account.monthsStreak
	});
	const loyalty = loyaltyBadges.length ? `${loyaltyBadges.map(badge => badge.label).join(', ')} loyalty` : null;

	const image = await renderPatronProfileCard({
		username: user.username ?? 'Adventurer',
		tierName: tier?.name ?? null,
		tierKey: tier?.key ?? null,
		title: account.title,
		flair: account.flair,
		months,
		loyaltyBadgeFiles: loyaltyBadges.map(badge => badge.key),
		totalLevel: user.totalLevel,
		clPercent: cl.percent,
		favoritePetId: petId,
		favoritePetName: petId ? (Items.get(petId)?.name ?? null) : null,
		rarestDropId: rare?.id ?? null,
		rarestDropName: rare?.name ?? null,
		bankBackgroundId: user.user.bankBackground
	});

	return {
		image,
		caption: buildCaption(user, tier, account.title, loyalty)
	};
}

function buildCaption(user: MUser, tier: BscPatronTier | null, title: string | null, loyalty: string | null): string {
	const bits = [user.usernameOrMention, tier ? `${tier.name}` : null, title, loyalty].filter(Boolean);
	return bits.join(' · ');
}

export function profileRequiresTopDog(perkTier: number) {
	return perkTier >= PerkTier.Four;
}
