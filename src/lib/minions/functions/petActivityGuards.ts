export const PET_UNEQUIP_BUSY_MESSAGE = 'You cant unequip your pet while your minion is busy.';
export const PET_PAINT_BUSY_MESSAGE = 'You cant paint that pet while your minion is busy.';

export function busyBlocksUnequipOrSwap(isBusy: boolean, equippedPetId: number | null | undefined): string | null {
	if (isBusy && equippedPetId) return PET_UNEQUIP_BUSY_MESSAGE;
	return null;
}

export function busyBlocksPaintEquippedPet(
	isBusy: boolean,
	equippedPetId: number | null | undefined,
	itemId: number
): string | null {
	if (isBusy && equippedPetId === itemId) return PET_PAINT_BUSY_MESSAGE;
	return null;
}
