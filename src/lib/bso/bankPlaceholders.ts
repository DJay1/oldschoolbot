export const PLACEHOLDER_FIRST_ID = 74_300;
export const PLACEHOLDER_COUNT = 56;

export const PLACEHOLDER_ITEM_IDS: number[] = Array.from(
	{ length: PLACEHOLDER_COUNT },
	(_, i) => PLACEHOLDER_FIRST_ID + i
);

export function isPlaceholderItem(itemID: number) {
	return itemID >= PLACEHOLDER_FIRST_ID && itemID < PLACEHOLDER_FIRST_ID + PLACEHOLDER_COUNT;
}

export function placeholderName(index: number) {
	return `Placeholder(${index})`;
}
