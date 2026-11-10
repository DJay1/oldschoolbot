import { PerkTier } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import { getBscPatronAccount, updateBscPatronAccount } from '@/lib/bsc/patronAccount.js';
import { loyaltyBadgeEmoji, loyaltyBadgeLabel, loyaltyTierForMonths } from '@/lib/bsc/patronLoyalty.js';
import { bscPatronTierFromBits, type BscPatronTier } from '@/lib/bsc/patronTiers.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { allPetIDs } from '@/lib/data/CollectionsExport.js';
import { calcCLDetails } from '@/lib/data/Collections.js';

const PET_ID_SET = new Set(allPetIDs);

export function ownedPatronPets(user: MUser): number[] {
	const ids: number[] = [];
	for (const id of PET_ID_SET) {
		if (user.cl.has(id) || user.bank.has(id) || user.user.minion_equippedPet === id) ids.push(id);
	}
	return ids;
}

export function parseFavoritePetInput(user: MUser, input: string | undefined): number | 'skip' | null {
	if (!input || /^skip|none|clear$/i.test(input.trim())) return input && /^skip|none|clear$/i.test(input.trim()) ? 'skip' : null;
	const item = Items.get(input);
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

export async function setFavoritePatronPet(user: MUser, input: string | undefined): Promise<{ petId: number | null; message: string }> {
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

export async function generatePatronProfileCard(user: MUser): Promise<{ image: Buffer; needsFavorite: boolean; caption: string }> {
	const account = await getBscPatronAccount(user.id);
	const tier = bscPatronTierFromBits(user.bitfield);
	const needsFavorite = account.favoritePetId === null && ownedPatronPets(user).length > 0;
	const petId = account.favoritePetId ?? defaultFavoritePet(user);
	const rare = rarestCollectionItem(user);
	const cl = calcCLDetails(user);
	const loyalty = loyaltyBadgeLabel(account.monthsTotal, account.monthsStreak);
	const loyaltyEmoji = loyaltyBadgeEmoji(account.monthsTotal, account.monthsStreak);

	const width = 520;
	const height = 300;
	const canvas = new OSRSCanvas({ width, height });
	const ctx = canvas.ctx;
	ctx.fillStyle = '#1A120C';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = tierColor(tier);
	ctx.lineWidth = 4;
	ctx.strokeRect(6, 6, width - 12, height - 12);

	ctx.fillStyle = '#F5E6C8';
	canvas.drawText({ text: user.username ?? 'Adventurer', x: 24, y: 44, color: '#F5E6C8' });
	canvas.drawText({
		text: tier ? `${tier.name} patron` : 'Not currently a patron',
		x: 24,
		y: 68,
		color: tierColor(tier)
	});
	if (account.title) {
		canvas.drawText({ text: account.title, x: 24, y: 90, color: '#E8C99A' });
	}
	if (loyalty) {
		canvas.drawText({ text: loyalty, x: 24, y: 112, color: '#C9B4F0' });
	}

	canvas.drawText({ text: `Total level: ${user.totalLevel.toLocaleString()}`, x: 24, y: 150, color: '#FFFFFF' });
	canvas.drawText({ text: `Collection log: ${cl.percent.toFixed(1)}%`, x: 24, y: 172, color: '#FFFFFF' });
	canvas.drawText({
		text: rare ? `Rarest drop: ${rare.name}` : 'Rarest drop: none yet',
		x: 24,
		y: 194,
		color: '#FFFFFF'
	});
	canvas.drawText({
		text: petId ? `Favorite pet: ${Items.get(petId)?.name}` : 'Favorite pet: none yet',
		x: 24,
		y: 216,
		color: '#FFFFFF'
	});
	canvas.drawText({ text: 'Bark School Corgo', x: 24, y: 270, color: '#9A8B78' });

	if (petId) {
		await canvas.drawItemIDSprite({ itemID: petId, x: 400, y: 90, user });
	}
	if (rare) {
		await canvas.drawItemIDSprite({ itemID: rare.id, x: 440, y: 160, user });
	}

	void loyaltyEmoji;
	return {
		image: await canvas.toBuffer(),
		needsFavorite,
		caption: buildCaption(user, tier, account.title, loyalty)
	};
}

function buildCaption(user: MUser, tier: BscPatronTier | null, title: string | null, loyalty: string | null): string {
	const bits = [user.usernameOrMention, tier ? `${tier.name}` : null, title, loyalty].filter(Boolean);
	return bits.join(' · ');
}

function tierColor(tier: BscPatronTier | null): string {
	switch (tier?.key) {
		case 'pup':
			return '#C4A574';
		case 'goodboy':
			return '#8B5A2B';
		case 'topdog':
			return '#4F7FE8';
		case 'alpha':
			return '#C84E9A';
		case 'packleader':
			return '#C45C26';
		case 'biggestofdogs':
			return '#D4A017';
		default:
			return '#7A6A58';
	}
}

export function profileRequiresTopDog(perkTier: number) {
	return perkTier >= PerkTier.Four;
}
