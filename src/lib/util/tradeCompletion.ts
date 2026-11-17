import type { Bank } from 'oldschooljs';

export const TRADE_BANK_DISPLAY_MAX = 850;

export function formatBankForDisplay(bank: Bank): string {
	const fullStr = bank.toStringFull();
	if (fullStr.length > TRADE_BANK_DISPLAY_MAX) {
		return bank.toString(); // abbreviated with toKMB formatting
	}
	return fullStr;
}

export function buildTradeCompletionContent(
	senderMention: string,
	itemsSentDisplay: string,
	recipientMention: string,
	itemsReceivedDisplay: string
): string {
	return `${senderMention} sold ${itemsSentDisplay} to ${recipientMention} in return for ${itemsReceivedDisplay}.`;
}
