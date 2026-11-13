import { Bank } from 'oldschooljs';

/**
 * Take items after a confirmation prompt: re-sync, then removeItemsFromBank
 * (throws if the items are gone). See docs/anti-exploit-checklist.md.
 */
export async function takeBankAfterConfirm(
	user: MUser,
	bank: Bank,
	missingMessage = "You don't own those items."
): Promise<{ ok: true } | { ok: false; message: string }> {
	await user.sync();
	if (bank.length === 0) {
		return { ok: false, message: 'No items were given.' };
	}
	if (!user.bankWithGP.has(bank)) {
		return { ok: false, message: missingMessage };
	}
	try {
		await user.removeItemsFromBank(bank);
		return { ok: true };
	} catch {
		return { ok: false, message: missingMessage };
	}
}
