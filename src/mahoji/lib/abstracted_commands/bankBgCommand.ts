import { stringMatches } from '@oldschoolgg/toolkit';
import { Bank, resolveItems, toKMB } from 'oldschooljs';

import { formatBscPatronRequirement } from '@/lib/bsc/patronTiers.js';
import { bankImageTask } from '@/lib/canvas/bankImage.js';
import type { BankBackground } from '@/lib/minions/data/bankBackgrounds.js';
import { userCanAccessBankBg } from '@/lib/bsc/bankBgAccess.js';
import { withPatreonLink } from '@/lib/patreonLink.js';
import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';

async function formatOwnerNames(ownerIDs: string[]): Promise<string> {
	const names: string[] = [];
	for (const id of ownerIDs) {
		try {
			const name = await Cache.getUsername(id);
			names.push(name && name !== id ? `**${name}**` : `<@${id}>`);
		} catch {
			names.push(`<@${id}>`);
		}
	}
	if (names.length === 0) return 'its owner';
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

export { userCanAccessBankBg } from '@/lib/bsc/bankBgAccess.js';

export async function bankBgUnavailableReason(
	user: MUser,
	bg: BankBackground,
	linkedAccountIDs: string[] = [user.id]
): Promise<string | null> {
	if (userCanAccessBankBg(user, bg, linkedAccountIDs)) return null;

	if (bg.owners && bg.owners.length > 0) {
		const who = await formatOwnerNames(bg.owners);
		return `This background is exclusive to ${who}. It can't be unlocked by anyone else.`;
	}

	if (bg.storeBitField) {
		return 'This background is unlocked from the store (permanent bank background packs). You do not own it yet.';
	}

	if (bg.perkTierNeeded) {
		return withPatreonLink(formatBscPatronRequirement(bg.perkTierNeeded));
	}

	if (bg.bitfield) {
		return "You're not eligible to use this bank background (missing a required unlock flag).";
	}

	if (!bg.available) {
		return 'This bank background is not currently available to unlock.';
	}

	return null;
}

export async function bankBgCommand(interaction: MInteraction, user: MUser, name: string) {
	// Backgrounds load lazily on the first bank image, so load them here too right after a restart.
	if (!bankImageTask.ready) {
		await bankImageTask.init();
		bankImageTask.ready = true;
	}
	const bankImages = bankImageTask.backgroundImages;
	const linkedAccountIDs = await findGroupOfUser(user.id);
	const selectedImage = bankImages.find(img => stringMatches(img.name, name));

	if (!selectedImage) {
		const visible = bankImages.filter(bg => userCanAccessBankBg(user, bg, linkedAccountIDs));
		return `No bank background named "${name}". Backgrounds you can use: ${visible.map(img => img.name).join(', ')}.`;
	}

	if (user.user.bankBackground === selectedImage.id) {
		return 'This is already your bank background.';
	}

	if (user.isModOrAdmin()) {
		await user.update({
			bankBackground: selectedImage.id
		});
		return `Your bank background is now **${selectedImage.name}**!`;
	}

	// Custom backgrounds belong to specific players.
	if (selectedImage.owners?.includes(user.id) || selectedImage.owners?.some(id => linkedAccountIDs.includes(id))) {
		await user.update({
			bankBackground: selectedImage.id
		});
		return `Your bank background is now **${selectedImage.name}**!`;
	}

	if (selectedImage.owners && selectedImage.owners.length > 0) {
		return (await bankBgUnavailableReason(user, selectedImage, linkedAccountIDs))!;
	}

	if (selectedImage.storeBitField && user.user.store_bitfield.includes(selectedImage.storeBitField)) {
		await user.update({
			bankBackground: selectedImage.id
		});
		return `Your bank background is now **${selectedImage.name}**!`;
	}

	if (selectedImage.sacValueRequired) {
		const sac = Number(user.user.sacrificedValue);
		if (sac < selectedImage.sacValueRequired) {
			return `You have to have sacrificed at least ${toKMB(
				selectedImage.sacValueRequired
			)} GP worth of items to use this background.`;
		}
	}

	if (selectedImage.skillsNeeded) {
		const meets = user.hasSkillReqs(selectedImage.skillsNeeded);
		if (!meets) {
			return `You don't meet the skill requirements to use this background, you need: ${formatSkillRequirements(
				selectedImage.skillsNeeded
			)}.`;
		}
	}

	if (!selectedImage.available) {
		return (
			(await bankBgUnavailableReason(user, selectedImage, linkedAccountIDs)) ??
			'This bank background is not currently available to unlock.'
		);
	}

	if (selectedImage.bitfield && !user.bitfield.includes(selectedImage.bitfield)) {
		return "You're not eligible to use this bank background.";
	}

	// Check they have required collection log items.
	if (selectedImage.collectionLogItemsNeeded && !user.cl.has(selectedImage.collectionLogItemsNeeded)) {
		return `You're not worthy to use this background. You need these items in your Collection Log: ${new Bank(
			selectedImage.collectionLogItemsNeeded
		)}`;
	}

	// Check they have the required perk tier.
	if (selectedImage.perkTierNeeded && (await user.fetchPerkTier()) < selectedImage.perkTierNeeded) {
		return withPatreonLink(formatBscPatronRequirement(selectedImage.perkTierNeeded));
	}

	if (selectedImage.name === 'Pets') {
		const { cl } = user;
		const hasPet = resolveItems(['Rocky', 'Bloodhound', 'Giant squirrel', 'Baby chinchompa']).some(id =>
			cl.has(id)
		);
		if (!hasPet) {
			return 'You need to have one of these pets to purchase the Pets background: Rocky, Bloodhound, Giant squirrel, Baby chinchompa.';
		}
	}

	/**
	 * If this bank image has a gp or item cost, confirm and charge.
	 */
	const economyCost = new Bank();
	if (selectedImage.gpCost || selectedImage.itemCost) {
		const userBank = user.bank;

		// Ensure they have the required items.
		if (selectedImage.itemCost && !userBank.has(selectedImage.itemCost)) {
			return `You don't have the required items to purchase this background. You need: ${new Bank(
				selectedImage.itemCost
			)}, you're missing: ${new Bank(selectedImage.itemCost).remove(userBank)}.`;
		}

		// Ensure they have the required GP.
		if (selectedImage.gpCost && user.GP < selectedImage.gpCost) {
			return `You need ${selectedImage.gpCost.toLocaleString()} GP to purchase this background.`;
		}

		// Start building a string to show to the user.
		let str = `${user}, please confirm that you want to buy the **${selectedImage.name}** bank background for: `;

		// If theres an item cost or GP cost, add it to the string to show users the cost.
		if (selectedImage.itemCost) {
			str += new Bank(selectedImage.itemCost).toString();
			if (selectedImage.gpCost) {
				str += `, ${selectedImage.gpCost.toLocaleString()} GP.`;
			}
		} else if (selectedImage.gpCost) {
			str += `${selectedImage.gpCost.toLocaleString()} GP.`;
		}

		str +=
			" **Note:** You'll have to pay this cost again if you switch to another background and want this one again.";

		await interaction.confirmation(str);

		if (selectedImage.itemCost) {
			economyCost.add(selectedImage.itemCost);
			await user.removeItemsFromBank(new Bank(selectedImage.itemCost));
		}

		if (selectedImage.gpCost) {
			economyCost.add(selectedImage.gpCost);
			await user.removeItemsFromBank(new Bank().add('Coins', selectedImage.gpCost));
		}
	}

	await user.update({
		bankBackground: selectedImage.id
	});

	await ClientSettings.updateBankSetting('economyStats_bankBgCostBank', economyCost);

	return `Your bank background is now **${selectedImage.name}**!`;
}
