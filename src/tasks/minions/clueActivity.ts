import { CLUE_CASKET_DOUBLE_RATE, isWearingFullFirstAgeMaxSet } from '@/lib/bso/firstAge/shards.js';
import { incrementUserCounter } from '@/lib/bso/userCounter.js';

import { Time } from '@oldschoolgg/toolkit';
import { randInt, roll } from 'node-rng';
import { Bank, LootTable } from 'oldschooljs';

import { ClueTiers } from '@/lib/clues/clueTiers.js';
import type { ClueActivityTaskOptions } from '@/lib/types/minions.js';

export const FIRST_AGE_CASKET_DOUBLE_MESSAGE = 'Your First Age (max) set doubled your clue casket!';

/**
 * Zippy and the First Age (max) set each roll 1/15 on their own.
 * Zippy runs first and may double the whole clue loot. The set then doubles whatever
 * reward caskets are already in the loot, so Zippy's 1 -> 2 becomes 4 when both hit.
 */
export function firstAgeCasketDouble(input: {
	wearingFullMaxSet: boolean;
	rolledDouble: boolean;
	casketsAlready: number;
}): { extraCaskets: number; message: string | null } {
	if (!input.wearingFullMaxSet || !input.rolledDouble || input.casketsAlready <= 0) {
		return { extraCaskets: 0, message: null };
	}
	return { extraCaskets: input.casketsAlready, message: FIRST_AGE_CASKET_DOUBLE_MESSAGE };
}

const possibleFound = new LootTable()
	.add('Reward casket (beginner)')
	.add('Reward casket (beginner)')
	.add('Reward casket (beginner)')
	.add('Reward casket (easy)')
	.add('Reward casket (easy)')
	.add('Reward casket (easy)')
	.add('Reward casket (medium)')
	.add('Reward casket (medium)')
	.add('Reward casket (hard)')
	.add('Reward casket (elite)')
	.add('Reward casket (master)')
	.add('Tradeable Mystery Box')
	.add('Tradeable Mystery Box')
	.add('Untradeable Mystery Box');

export const clueTask: MinionTask = {
	type: 'ClueCompletion',
	async run(data: ClueActivityTaskOptions, { user, handleTripFinish }) {
		const { ci: clueID, userID, channelId, q: quantity, duration } = data;
		const clueTier = ClueTiers.find(mon => mon.id === clueID)!;

		await incrementUserCounter(userID, `cluecompletions.${clueTier.name}`, quantity);

		let str = `${user.mention}, ${user.minionName} finished completing ${quantity} ${clueTier.name} clues. ${
			user.minionName
		} carefully places the reward casket${
			quantity > 1 ? 's' : ''
		} in your bank. You can open this casket using \`/open name:${clueTier.name}\``;

		const loot = new Bank().add(clueTier.id, quantity);

		const firstAgeRolledDouble = isWearingFullFirstAgeMaxSet(user) && roll(CLUE_CASKET_DOUBLE_RATE);

		if (user.usingPet('Zippy') && duration > Time.Minute * 5) {
			const bonusLoot = new Bank();
			const numberOfMinutes = Math.floor(duration / Time.Minute);

			for (let i = 0; i < numberOfMinutes / randInt(5, 10); i++) {
				const item = possibleFound.roll().items()[0][0].id;
				bonusLoot.add(item);
			}
			if (bonusLoot.length > 0) {
				await ClientSettings.updateBankSetting('zippy_loot', bonusLoot);
				await user.statsBankUpdate('loot_from_zippy_bank', bonusLoot);
			}

			loot.add(bonusLoot);

			if (roll(CLUE_CASKET_DOUBLE_RATE)) {
				await ClientSettings.updateBankSetting('zippy_loot', loot);
				await user.statsBankUpdate('loot_from_zippy_bank', loot);
				loot.multiply(2);
				str += '\nZippy has **doubled** your loot.';
			}

			str += `\n\nZippy has found these items for you: ${new Bank(bonusLoot)}`;
		}

		const firstAgeDouble = firstAgeCasketDouble({
			wearingFullMaxSet: isWearingFullFirstAgeMaxSet(user),
			rolledDouble: firstAgeRolledDouble,
			casketsAlready: loot.amount(clueTier.id)
		});
		if (firstAgeDouble.extraCaskets > 0) {
			loot.add(clueTier.id, firstAgeDouble.extraCaskets);
			str += `\n${firstAgeDouble.message}`;
		}

		await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});
		handleTripFinish({ user, channelId, message: str, data, loot });
	}
};
