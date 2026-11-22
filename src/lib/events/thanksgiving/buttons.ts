import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import type { Bank } from 'oldschooljs';

import { isThanksgivingActive, thanksgivingCodeEnabled } from './core.js';
import {
	cornucopiaMaxMakeable,
	cornucopiaPartsHeld,
	thanksgivingMakeAndOfferButtonCustomId,
	thanksgivingMakeButtonCustomId
} from './make.js';

export function thanksgivingMakeButtons(
	userId: string,
	bank: Bank,
	options: { includeOffer: boolean }
): ButtonBuilder[] {
	const { bundles, baskets } = cornucopiaPartsHeld(bank);
	const maxMakeable = cornucopiaMaxMakeable(bundles, baskets);
	if (maxMakeable < 1 || !thanksgivingCodeEnabled()) return [];
	const buttons = [
		new ButtonBuilder()
			.setCustomId(thanksgivingMakeButtonCustomId(userId))
			.setLabel(`Make all (${maxMakeable.toLocaleString()})`.slice(0, 80))
			.setStyle(ButtonStyle.Primary)
	];
	if (options.includeOffer && isThanksgivingActive()) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(thanksgivingMakeAndOfferButtonCustomId(userId))
				.setLabel(`Make & offer all (${maxMakeable.toLocaleString()})`.slice(0, 80))
				.setStyle(ButtonStyle.Success)
		);
	}
	return buttons;
}

export function withThanksgivingMakeButtons(
	user: MUser,
	result: string | { content?: string; files?: unknown; components?: ButtonBuilder[] },
	options: { includeOffer: boolean }
): string | { content: string; files?: unknown; components: ButtonBuilder[] } {
	const buttons = thanksgivingMakeButtons(user.id, user.bank, options);
	if (buttons.length === 0) {
		return result;
	}
	if (typeof result === 'string') return { content: result, components: buttons };
	return { ...result, content: result.content ?? '', components: buttons };
}
