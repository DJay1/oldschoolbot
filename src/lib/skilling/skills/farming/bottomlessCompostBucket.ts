import { type Bank, type Item, Items, itemID } from 'oldschooljs';

import type { CropUpgradeType } from '@/prisma/main/enums.js';
import type { SafeUserUpdateInput } from '@/lib/user/update.js';

export const BOTTOMLESS_COMPOST_BUCKET_ID = itemID('Bottomless compost bucket');
export const BOTTOMLESS_COMPOST_BUCKET = Items.getOrThrow('Bottomless compost bucket');
export const BOTTOMLESS_COMPOST_MAX_CHARGES = 10_000;
export const BOTTOMLESS_COMPOST_CHARGES_PER_BUCKET = 2;

export const COMPOST_ITEM_TYPES = [
	{ type: 'ultracompost' as const, name: 'Ultracompost', id: itemID('Ultracompost') },
	{ type: 'supercompost' as const, name: 'Supercompost', id: itemID('Supercompost') },
	{ type: 'compost' as const, name: 'Compost', id: itemID('Compost') }
] as const;

export type BottomlessCompostType = (typeof COMPOST_ITEM_TYPES)[number]['type'];

export interface BottomlessCompostState {
	owned: boolean;
	charges: number;
	type: BottomlessCompostType | null;
}

export interface FillBottomlessResult {
	ok: true;
	bucketsToAdd: number;
	chargesToAdd: number;
	newCharges: number;
	type: BottomlessCompostType;
	nowFull: boolean;
	confirmMessage: string;
	successMessage: string;
}

export interface FillBottomlessError {
	ok: false;
	message: string;
}

export function isBottomlessCompostType(value: string | null | undefined): value is BottomlessCompostType {
	return value === 'compost' || value === 'supercompost' || value === 'ultracompost';
}

export function compostTypeName(type: BottomlessCompostType | CropUpgradeType): string {
	switch (type) {
		case 'ultracompost':
			return 'Ultracompost';
		case 'supercompost':
			return 'Supercompost';
		default:
			return 'Compost';
	}
}

export function compostTypeFromItemID(itemIDToCheck: number): BottomlessCompostType | null {
	return COMPOST_ITEM_TYPES.find(entry => entry.id === itemIDToCheck)?.type ?? null;
}

export function normalizeBottomlessState(state: {
	owned: boolean;
	charges?: number | null;
	type?: string | null;
}): BottomlessCompostState {
	const charges = Math.max(0, Math.min(BOTTOMLESS_COMPOST_MAX_CHARGES, Math.floor(state.charges ?? 0)));
	const type = charges > 0 && isBottomlessCompostType(state.type) ? state.type : null;
	return {
		owned: state.owned,
		charges: type ? charges : 0,
		type
	};
}

export function getBottomlessState(user: MUser): BottomlessCompostState {
	return normalizeBottomlessState({
		owned: user.bank.amount(BOTTOMLESS_COMPOST_BUCKET_ID) > 0,
		charges: user.user.bottomless_compost_charges,
		type: user.user.bottomless_compost_type
	});
}

export function usableBottomlessCharges(state: BottomlessCompostState, type: BottomlessCompostType): number {
	if (!state.owned || state.type !== type || state.charges <= 0) return 0;
	return state.charges;
}

export function availableCompostOfType(bank: Bank, state: BottomlessCompostState, type: BottomlessCompostType): number {
	return bank.amount(compostTypeName(type)) + usableBottomlessCharges(state, type);
}

export function splitCompostUse(
	state: BottomlessCompostState,
	type: BottomlessCompostType,
	quantityToDo: number
): { fromBucket: number; fromBank: number } {
	const fromBucket = Math.min(usableBottomlessCharges(state, type), quantityToDo);
	return {
		fromBucket,
		fromBank: quantityToDo - fromBucket
	};
}

export function applyBottomlessUse(state: BottomlessCompostState, chargesUsed: number): BottomlessCompostState {
	if (chargesUsed <= 0) return state;
	const charges = Math.max(0, state.charges - chargesUsed);
	return {
		owned: state.owned,
		charges,
		type: charges > 0 ? state.type : null
	};
}

export function bottomlessChargeUpdates(next: BottomlessCompostState): SafeUserUpdateInput {
	return {
		bottomless_compost_charges: next.charges,
		bottomless_compost_type: next.type
	};
}

export function checkBottomlessMessage(state: BottomlessCompostState): string {
	if (!state.owned) {
		return "You don't have a Bottomless compost bucket.";
	}
	if (!state.type || state.charges <= 0) {
		return 'Your compost bucket is currently empty.';
	}
	return `Your bottomless compost bucket is currently holding ${state.charges.toLocaleString()} uses of ${compostTypeName(state.type)}.`;
}

export function roomInBottomless(state: BottomlessCompostState): number {
	return Math.max(0, BOTTOMLESS_COMPOST_MAX_CHARGES - state.charges);
}

export function calcFillBottomless({
	state,
	compostType,
	ownedCompost,
	requestedQuantity
}: {
	state: BottomlessCompostState;
	compostType: BottomlessCompostType;
	ownedCompost: number;
	requestedQuantity: number | null;
}): FillBottomlessResult | FillBottomlessError {
	if (!state.owned) {
		return { ok: false, message: "You don't have a Bottomless compost bucket." };
	}

	const typeName = compostTypeName(compostType);
	if (state.type && state.type !== compostType) {
		if (ownedCompost <= 0) {
			return {
				ok: false,
				message: `Your bottomless compost bucket contains ${compostTypeName(state.type)}. Sadly you don't have any more to fill it with any further.`
			};
		}
		return {
			ok: false,
			message: `Your bottomless compost bucket already contains ${compostTypeName(state.type)}. You cannot fill it with ${typeName}.`
		};
	}

	if (ownedCompost <= 0) {
		return { ok: false, message: "You don't have any compost to fill your bottomless compost bucket with." };
	}

	const room = roomInBottomless(state);
	if (room < BOTTOMLESS_COMPOST_CHARGES_PER_BUCKET) {
		if (state.charges >= BOTTOMLESS_COMPOST_MAX_CHARGES) {
			return {
				ok: false,
				message:
					"Your bottomless compost bucket is full. You won't be able to squeeze any more compost in there."
			};
		}
		return {
			ok: false,
			message:
				"Your bottomless compost bucket is just about full. You won't be able to squeeze any more compost in there."
		};
	}

	const maxBuckets = Math.min(ownedCompost, Math.floor(room / BOTTOMLESS_COMPOST_CHARGES_PER_BUCKET));
	const bucketsToAdd = requestedQuantity === null ? maxBuckets : Math.min(maxBuckets, requestedQuantity);
	if (bucketsToAdd <= 0) {
		return { ok: false, message: "You don't have any compost to fill your bottomless compost bucket with." };
	}

	const chargesToAdd = bucketsToAdd * BOTTOMLESS_COMPOST_CHARGES_PER_BUCKET;
	const newCharges = state.charges + chargesToAdd;
	const nowFull = newCharges >= BOTTOMLESS_COMPOST_MAX_CHARGES;
	const successMessage =
		bucketsToAdd === 1
			? `You fill your bottomless compost bucket with a single bucket of ${typeName}. Your bottomless compost bucket now contains a total of ${newCharges.toLocaleString()} uses.${nowFull ? ' Your bottomless compost bucket is now full!' : ''}`
			: `You fill your bottomless compost bucket with ${bucketsToAdd.toLocaleString()} buckets of ${typeName}. Your bottomless compost bucket now contains a total of ${newCharges.toLocaleString()} uses.${nowFull ? ' Your bottomless compost bucket is now full!' : ''}`;

	return {
		ok: true,
		bucketsToAdd,
		chargesToAdd,
		newCharges,
		type: compostType,
		nowFull,
		confirmMessage: `Fill your Bottomless compost bucket with ${bucketsToAdd.toLocaleString()} buckets of ${typeName}? You will get ${chargesToAdd.toLocaleString()} uses, for a total of ${newCharges.toLocaleString()}, and ${bucketsToAdd.toLocaleString()} empty Bucket${bucketsToAdd === 1 ? '' : 's'} back.`,
		successMessage
	};
}

export function calcEmptyBottomless(
	state: BottomlessCompostState
): { ok: true; confirmMessage: string; successMessage: string } | { ok: false; message: string } {
	if (!state.owned) {
		return { ok: false, message: "You don't have a Bottomless compost bucket." };
	}
	if (!state.type || state.charges <= 0) {
		return { ok: false, message: 'Your compost bucket is currently empty.' };
	}
	const typeName = compostTypeName(state.type);
	return {
		ok: true,
		confirmMessage: `Empty your Bottomless compost bucket? This discards ${state.charges.toLocaleString()} uses of ${typeName} and cannot be undone.`,
		successMessage: `You empty your Bottomless compost bucket, discarding ${state.charges.toLocaleString()} uses of ${typeName}.`
	};
}

export function wouldLoseChargedBottomlessBucket({
	currentCount,
	removeCount,
	addCount,
	nextCharges
}: {
	currentCount: number;
	removeCount: number;
	addCount: number;
	nextCharges: number;
}): boolean {
	if (nextCharges <= 0) return false;
	return currentCount - removeCount + addCount < 1;
}

export function chargedBottomlessRemovalError(state: BottomlessCompostState): string {
	const typeText = state.type
		? `${state.charges.toLocaleString()} uses of ${compostTypeName(state.type)}`
		: `${state.charges.toLocaleString()} uses`;
	return `Your Bottomless compost bucket still has ${typeText}. Empty it first, or keep one in your bank.`;
}

export function resolveNextBottomlessCharges(
	currentCharges: number,
	update: SafeUserUpdateInput['bottomless_compost_charges']
): number {
	if (update === undefined) return currentCharges;
	if (typeof update === 'number') return update;
	if (typeof update === 'object' && update !== null) {
		if ('increment' in update && typeof update.increment === 'number') {
			return currentCharges + update.increment;
		}
		if ('decrement' in update && typeof update.decrement === 'number') {
			return currentCharges - update.decrement;
		}
	}
	return currentCharges;
}

export function bottomlessItemsForUseAutocomplete(): number[] {
	return [BOTTOMLESS_COMPOST_BUCKET_ID, ...COMPOST_ITEM_TYPES.map(entry => entry.id)];
}

export function isBottomlessUseItem(item: Item | number): boolean {
	const id = typeof item === 'number' ? item : item.id;
	return bottomlessItemsForUseAutocomplete().includes(id);
}
