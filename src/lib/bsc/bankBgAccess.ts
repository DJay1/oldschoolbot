import type { BankBackground } from '@/lib/minions/data/bankBackgrounds.js';

/** True when this user may select/use the background (ignoring GP/item purchase cost). */
export function userCanAccessBankBg(user: MUser, bg: BankBackground, linkedAccountIDs: string[] = [user.id]): boolean {
	if (user.isModOrAdmin()) return true;
	if (bg.owners?.some(id => linkedAccountIDs.includes(id) || id === user.id)) return true;
	if (bg.storeBitField && user.user.store_bitfield.includes(bg.storeBitField)) return true;
	if (!bg.available) return false;
	return true;
}
