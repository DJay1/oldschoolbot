import { MessageFlags } from '@oldschoolgg/discord';

import { unqueuedTransactItems } from '@/lib/util/transactItemsFromBank.js';
import { userQueueFn } from '@/lib/util/userQueues.js';
import { thanksgivingMakeButtons } from './buttons.js';
import { isThanksgivingActive, type ThanksgivingRng, thanksgivingCodeEnabled } from './core.js';
import { ThanksgivingItem } from './items.js';
import {
	formatCornucopiaMakeConfirm,
	formatCornucopiaMakeSuccess,
	formatCornucopiaPartsChanged,
	formatMakeAndOfferConfirm,
	isThanksgivingMakeAndOfferButton,
	previewCornucopiaMake,
	resolveCornucopiaMakeAfterConfirm,
	thanksgivingButtonOwnerId
} from './make.js';
import { thanksgivingOffer } from './offer.js';

function sourceMessageIsEphemeral(interaction: { message?: { flags?: number } | null }): boolean {
	return Boolean((interaction.message?.flags ?? 0) & MessageFlags.Ephemeral);
}

function withSourceEphemeral(
	result: string | Record<string, unknown>,
	ephemeral: boolean
): string | Record<string, unknown> {
	if (!ephemeral) return result;
	if (typeof result === 'string') return { content: result, ephemeral: true };
	return { ...result, ephemeral: true };
}

async function executeCornucopiaMake(user: MUser, confirmedQuantity: number, requested?: number) {
	const next = resolveCornucopiaMakeAfterConfirm(user.bank, requested, confirmedQuantity);
	if (!next.ok) return { ok: false as const, error: next.error };
	if (!user.owns(next.inItems)) return { ok: false as const, error: formatCornucopiaPartsChanged(user.bank) };
	await unqueuedTransactItems({
		user,
		collectionLog: true,
		itemsToAdd: next.outItems,
		itemsToRemove: next.inItems
	});
	await ClientSettings.updateBankSetting('create_cost', next.inItems);
	await ClientSettings.updateBankSetting('create_loot', next.outItems);
	await user.statsBankUpdate('create_cost_bank', next.inItems);
	await user.statsBankUpdate('create_loot_bank', next.outItems);
	return { ok: true as const, preview: next, message: formatCornucopiaMakeSuccess(next, confirmedQuantity) };
}

export async function handleThanksgivingMakeButton({
	user,
	interaction,
	id,
	rng
}: {
	user: MUser;
	interaction: {
		userId: string;
		message?: { flags?: number } | null;
		confirmation: (message: { content: string; confirmLabel?: string; ephemeral?: boolean }) => Promise<void>;
	};
	id: string;
	rng: ThanksgivingRng;
}) {
	const ephemeral = sourceMessageIsEphemeral(interaction);
	const ownerId = thanksgivingButtonOwnerId(id);
	if (!ownerId || ownerId !== interaction.userId || ownerId !== user.id) {
		return { content: 'This button is only for the person who ran the command.', ephemeral: true };
	}
	if (!thanksgivingCodeEnabled()) return { content: 'You cannot make this right now.', ephemeral: true };

	const makeAndOffer = isThanksgivingMakeAndOfferButton(id);
	if (makeAndOffer && !isThanksgivingActive()) {
		return { content: 'The Straw Hat Harvest is not running right now.', ephemeral: true };
	}

	await user.sync();
	const preview = previewCornucopiaMake(user.bank);
	if (!preview.ok) return { content: preview.error, ephemeral: true };

	if (makeAndOffer) {
		const alreadyOwned = user.bank.amount(ThanksgivingItem.BOUNTIFUL_CORNUCOPIA);
		const confirm = formatMakeAndOfferConfirm(preview, alreadyOwned);
		await interaction.confirmation({
			content: confirm.content,
			confirmLabel: confirm.confirmLabel,
			ephemeral
		});
		return userQueueFn(user.id, async () => {
			await user.sync();
			const made = await executeCornucopiaMake(user, preview.quantity, undefined);
			if (!made.ok) return withSourceEphemeral(made.error, ephemeral);
			if (!isThanksgivingActive()) {
				return withSourceEphemeral(
					`${made.message} The Straw Hat Harvest is not running, so nothing was offered.`,
					ephemeral
				);
			}
			const offerResult = await thanksgivingOffer(user, 'all', rng, { alreadyQueued: true });
			if (typeof offerResult === 'string') {
				return withSourceEphemeral(`${made.message}\n${offerResult}`, ephemeral);
			}
			return withSourceEphemeral(
				{
					content: `${made.message}\n${offerResult.content}`,
					files: 'files' in offerResult ? offerResult.files : undefined,
					components: thanksgivingMakeButtons(user.id, user.bank, { includeOffer: true })
				},
				ephemeral
			);
		});
	}

	const confirm = formatCornucopiaMakeConfirm(preview);
	await interaction.confirmation({
		content: confirm.content,
		confirmLabel: confirm.confirmLabel,
		ephemeral
	});
	return userQueueFn(user.id, async () => {
		await user.sync();
		const made = await executeCornucopiaMake(user, preview.quantity, undefined);
		if (!made.ok) return withSourceEphemeral(made.error, ephemeral);
		return withSourceEphemeral(
			{
				content: made.message,
				components: thanksgivingMakeButtons(user.id, user.bank, { includeOffer: isThanksgivingActive() })
			},
			ephemeral
		);
	});
}
