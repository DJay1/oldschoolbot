import { stringMatches } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import Potions from '@/lib/minions/data/potions.js';

export function countPotionDoses(bank: Bank, potionItems: number[]): number {
	let doses = 0;
	for (let i = 0; i < potionItems.length; i++) {
		doses += bank.amount(potionItems[i]) * (i + 1);
	}
	return doses;
}

export type DecantSuccess = {
	potionsToAdd: Bank;
	potionsToRemove: Bank;
	sumOfPots: number;
	potionName: string;
	finalUserBank: Bank;
	error: null;
};

export default function decantPotionFromBank(
	userBank: Bank,
	potion: string,
	dose: number,
	quantity?: number
): DecantSuccess | { error: string } {
	const potionToDecant = Potions.find(pot => stringMatches(pot.name, potion));
	if (!potionToDecant) {
		return { error: "That's not a valid potion that you can decant." };
	}
	if (potionToDecant.items.length === 2 && dose > 2) return { error: 'You can only decant mixes into 1 or 2 doses.' };
	if (potionToDecant.items.length === 1) return { error: `You can't decant ${potionToDecant.name}.` };
	if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
		return { error: 'Invalid quantity.' };
	}
	const potionsToRemove = new Bank();
	const potionsToAdd = new Bank();
	let sumOfPots = 0;
	let totalDosesToCreate = 0;
	let remainingDosesWanted = quantity === undefined ? Number.POSITIVE_INFINITY : quantity * dose;

	for (let i = 0; i < potionToDecant.items.length; i++) {
		if (i === dose - 1) continue;
		if (remainingDosesWanted <= 0) break;
		const available = userBank.amount(potionToDecant.items[i]);
		if (available <= 0) continue;
		const doseSize = i + 1;
		const maxPotsByNeed = Number.isFinite(remainingDosesWanted)
			? Math.ceil(remainingDosesWanted / doseSize)
			: available;
		const qty = Math.min(available, maxPotsByNeed);
		if (qty > 0) {
			potionsToRemove.add(potionToDecant.items[i], qty);
			sumOfPots += qty;
			totalDosesToCreate += qty * doseSize;
			if (Number.isFinite(remainingDosesWanted)) {
				remainingDosesWanted -= qty * doseSize;
			}
		}
	}

	if (!totalDosesToCreate) {
		return { error: `You don't have any **${potionToDecant.name}** to decant!` };
	}

	const newPotionDoseRequested = Math.floor(totalDosesToCreate / dose);
	const leftOverDoses = totalDosesToCreate % dose;
	if (newPotionDoseRequested) {
		potionsToAdd.add(potionToDecant.items[dose - 1], newPotionDoseRequested);
	}
	if (leftOverDoses) {
		potionsToAdd.add(potionToDecant.items[leftOverDoses - 1], 1);
	}

	return {
		potionsToAdd,
		potionsToRemove,
		sumOfPots,
		potionName: potionToDecant.name,
		finalUserBank: new Bank().add(userBank).add(potionsToAdd).remove(potionsToRemove),
		error: null
	};
}

export function decantAllPotionsFromBank(
	userBank: Bank,
	dose: number,
	quantity?: number
): { potionsToAdd: Bank; potionsToRemove: Bank; results: DecantSuccess[]; error: null } {
	const potionsToAdd = new Bank();
	const potionsToRemove = new Bank();
	const results: DecantSuccess[] = [];
	for (const pot of Potions) {
		const res = decantPotionFromBank(userBank, pot.name, dose, quantity);
		if (res.error !== null) continue;
		potionsToAdd.add(res.potionsToAdd);
		potionsToRemove.add(res.potionsToRemove);
		results.push(res);
	}
	return { potionsToAdd, potionsToRemove, results, error: null };
}

const DECANT_REPLY_LIMIT = 1850;

export function formatDecantReply(
	results: { sumOfPots: number; potionName: string; potionsToAdd: Bank }[],
	dose: number
): string {
	if (results.length === 0) {
		return "You don't have any potions to decant!";
	}
	if (results.length === 1) {
		const r = results[0];
		return `You decanted **${r.sumOfPots}x ${r.potionName}${r.sumOfPots > 0 ? 's' : ''}** into **${r.potionsToAdd}**.`;
	}

	const header = `You decanted **${results.length} potion types** into ${dose}-dose potions:\n`;
	const lines = results.map(r => `${r.sumOfPots}x ${r.potionName} into ${r.potionsToAdd}`);
	const moreText = (hidden: number) => `\nand ${hidden} more.`;
	let included = lines.length;
	const build = (count: number) => {
		const hidden = lines.length - count;
		return hidden > 0 ? header + lines.slice(0, count).join('\n') + moreText(hidden) : header + lines.join('\n');
	};
	while (included > 1 && build(included).length > DECANT_REPLY_LIMIT) {
		included--;
	}
	const content = build(included);
	if (content.length > DECANT_REPLY_LIMIT) {
		return `You decanted **${results.length} potion types** into ${dose}-dose potions. The full list was too long to show.`;
	}
	return content;
}
