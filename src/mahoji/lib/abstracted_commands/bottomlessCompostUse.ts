import { Bank, type Item } from 'oldschooljs';

import {
	BOTTOMLESS_COMPOST_BUCKET_ID,
	bottomlessChargeUpdates,
	calcEmptyBottomless,
	calcFillBottomless,
	checkBottomlessMessage,
	compostTypeFromItemID,
	getBottomlessState
} from '@/lib/skilling/skills/farming/bottomlessCompostBucket.js';

export async function handleBottomlessCompostUse({
	user,
	items,
	quantity,
	empty,
	interaction
}: {
	user: MUser;
	items: Item[];
	quantity?: number;
	empty?: boolean;
	interaction?: MInteraction;
}): Promise<string> {
	const emptyRequested = Boolean(empty);
	const hasBucketItem = items.some(item => item.id === BOTTOMLESS_COMPOST_BUCKET_ID);
	const compostItem = items.find(item => compostTypeFromItemID(item.id) !== null);

	if (emptyRequested && compostItem) {
		return "You can't empty and fill your Bottomless compost bucket at the same time.";
	}

	if (emptyRequested) {
		if (items.length > 1 || (items.length === 1 && !hasBucketItem)) {
			return 'To empty your Bottomless compost bucket, use it with empty enabled.';
		}
		const result = calcEmptyBottomless(getBottomlessState(user));
		if (!result.ok) return result.message;
		if (!interaction) {
			return 'You need to confirm emptying your Bottomless compost bucket.';
		}
		await interaction.confirmation(result.confirmMessage);
		await user.transactItems({
			otherUpdates: bottomlessChargeUpdates({ owned: true, charges: 0, type: null })
		});
		return result.successMessage;
	}

	if (!hasBucketItem) {
		return "That's not a usable combination.";
	}

	if (items.length === 1) {
		return checkBottomlessMessage(getBottomlessState(user));
	}

	if (!compostItem) {
		return "That's not a usable combination.";
	}

	const compostType = compostTypeFromItemID(compostItem.id);
	if (!compostType) {
		return "That's not a usable combination.";
	}
	if (quantity !== undefined && quantity < 1) {
		return 'You must fill at least one bucket of compost.';
	}

	const preview = calcFillBottomless({
		state: getBottomlessState(user),
		compostType,
		ownedCompost: user.bank.amount(compostItem.id),
		requestedQuantity: quantity ?? null
	});
	if (!preview.ok) return preview.message;
	if (!interaction) {
		return 'You need to confirm filling your Bottomless compost bucket.';
	}
	await interaction.confirmation(preview.confirmMessage);
	await user.transactItems({
		itemsToRemove: new Bank().add(compostItem.id, preview.bucketsToAdd),
		itemsToAdd: new Bank().add('Bucket', preview.bucketsToAdd),
		otherUpdates: freshUser => {
			const again = calcFillBottomless({
				state: getBottomlessState(freshUser),
				compostType,
				ownedCompost: freshUser.bank.amount(compostItem.id),
				requestedQuantity: preview.bucketsToAdd
			});
			if (!again.ok || again.bucketsToAdd !== preview.bucketsToAdd) {
				throw new Error('Your Bottomless compost bucket could not be filled. Try again.');
			}
			return bottomlessChargeUpdates({
				owned: true,
				charges: again.newCharges,
				type: again.type
			});
		}
	});
	return preview.successMessage;
}
