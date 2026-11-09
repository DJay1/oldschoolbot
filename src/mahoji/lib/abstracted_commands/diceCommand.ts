import { Bank, toKMB } from 'oldschooljs';

import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

/** Percentile roll (0-99). Player wins on roll >= this value => 48% win / 52% house. */
export const DICE_PLAYER_WIN_MIN_ROLL = 52;

export async function diceCommand(rng: RNGProvider, user: MUser, interaction: MInteraction, diceamount?: string) {
	await interaction.defer();
	const roll = rng.randInt(0, 99);
	const amount = mahojiParseNumber({ input: diceamount, min: 1, max: 500_000_000_000 });

	if (!diceamount) {
		return `You rolled **${roll}** on the percentile dice.`;
	}

	if (!amount) {
		return `You rolled **${roll}** on the percentile dice.`;
	}
	if (user.isIronman) return "You're an ironman and you cant play dice.";

	if (amount > 50_000_000_000) {
		return 'You can only dice up to 50b at a time!';
	}

	if (amount < 1_000_000) {
		return 'You have to dice at least 1,000,000.';
	}

	const gp = user.GP;
	if (amount > gp) return "You don't have enough GP.";
	const won = roll >= DICE_PLAYER_WIN_MIN_ROLL;
	const amountToAdd = won ? amount : -amount;

	if (won) {
		await user.statsUpdate({
			dice_wins: { increment: 1 }
		});
		await user.addItemsToBank({ items: new Bank().add('Coins', amount) });
	} else {
		await user.statsUpdate({
			dice_losses: { increment: 1 }
		});
		await user.removeItemsFromBank(new Bank().add('Coins', amount));
	}
	await ClientSettings.updateClientGPTrackSetting('gp_dice', amountToAdd);
	await user.updateGPTrackSetting('gp_dice', amountToAdd);

	let resultStr = `${user.badgedUsername} rolled **${roll}** on the percentile dice, and you ${
		won ? 'won' : 'lost'
	} ${toKMB(amountToAdd)} GP.`;
	if (amount >= 100_000_000 && won && rng.percentChance(3)) {
		await user.addItemsToBank({ items: new Bank().add('Gamblers bag'), collectionLog: true });
		resultStr += `\n\nYou received a **Gamblers Bag**.`;
	}

	return resultStr;
}
