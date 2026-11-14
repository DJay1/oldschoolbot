import type { Bank } from 'oldschooljs';

import type { BankBackground } from '@/lib/minions/data/bankBackgrounds.js';

type SortableBg = Pick<BankBackground, 'id' | 'name' | 'collectionLogItemsNeeded' | 'seasonal'>;

/**
 * Discord only shows the first 25 autocomplete choices, so put the backgrounds a player is most
 * likely to want first: the one in use and owned ones, then ones unlocked through the collection
 * log, then seasonal/event ones, then everything else (original order kept inside each group).
 * Typed text matches anywhere in the name, so "merry" and "going" both find Going Merry.
 */
export function sortBankBgsForAutocomplete<T extends SortableBg>(
	bgs: readonly T[],
	{
		value,
		ownedIDs,
		currentID,
		cl
	}: { value?: string | null; ownedIDs: readonly number[]; currentID?: number | null; cl: Pick<Bank, 'has'> }
): T[] {
	const search = (value ?? '').trim().toLowerCase();
	const rank = (bg: T): number => {
		if (bg.id === currentID || ownedIDs.includes(bg.id)) return 0;
		if (bg.collectionLogItemsNeeded && cl.has(bg.collectionLogItemsNeeded)) return 1;
		if (bg.seasonal) return 2;
		return 3;
	};
	return bgs
		.filter(bg => (search ? bg.name.toLowerCase().includes(search) : true))
		.map((bg, index) => ({ bg, index, rank: rank(bg) }))
		.sort((a, b) => a.rank - b.rank || a.index - b.index)
		.map(entry => entry.bg);
}
