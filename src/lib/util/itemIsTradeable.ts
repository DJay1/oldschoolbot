import { isSuperUntradeable } from '@/lib/bso/bsoUtil.js';
import { userHasPatronDyeLock } from '@/lib/bsc/patronDyes.js';

import { EItem, Items } from 'oldschooljs';

export default function itemIsTradeable(itemID: number | string, allowCoins = false, userId?: string) {
	const osItem = Items.getOrThrow(itemID);
	if (allowCoins && osItem.id === EItem.COINS) return true;
	if (userHasPatronDyeLock(userId, osItem.id)) return false;

	return !isSuperUntradeable(osItem);
}
