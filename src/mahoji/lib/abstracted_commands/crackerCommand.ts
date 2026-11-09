import { partyHatTableRoll } from '@/lib/bso/holidayItems.js';
import { makeCrackerWhoWonImage } from '@/lib/canvas/crackerImage.js';

import type { IUser } from '@oldschoolgg/schemas';
import { Emoji } from '@oldschoolgg/toolkit';
import { cryptoRng } from 'node-rng/crypto';
import { Bank, LootTable } from 'oldschooljs';

import { addToOpenablesScores } from '@/mahoji/mahojiSettings.js';

const JunkTable = new LootTable()
	.add('Chocolate bar', 1, 1 / 5.2)
	.add('Silver bar', 1, 1 / 7.6)
	.add('Spinach roll', 1, 1 / 8)
	.add('Chocolate cake', 1, 1 / 8.6)
	.add('Holy symbol', 1, 1 / 11.7)
	.add('Silk', 1, 1 / 12.2)
	.add('Gold ring', 1, 1 / 13.9)
	.add('Black dagger', 1, 1 / 24.3)
	.add('Law rune', 1, 1 / 25.3);

function displayName(user: MUser): string {
	return user.username || user.id;
}

export async function crackerCommand({
	ownerID,
	otherPersonID,
	interaction,
	otherPersonAPIUser
}: {
	otherPersonAPIUser: IUser;
	ownerID: string;
	otherPersonID: string;
	interaction: MInteraction;
}) {
	const otherPerson = await mUserFetch(otherPersonID);
	const owner = await mUserFetch(ownerID);
	if (owner.isIronman && owner.id === otherPerson.id) {
		if (!owner.owns('Christmas cracker')) {
			return "You don't have any Christmas crackers!";
		}
		await owner.removeItemsFromBank(new Bank().add('Christmas cracker', 1));
		const loot = partyHatTableRoll();
		await owner.addItemsToBank({ items: loot, collectionLog: true });
		const image = await makeCrackerWhoWonImage({
			ownerName: displayName(owner),
			otherName: displayName(owner),
			winnerName: displayName(owner),
			loserName: displayName(owner),
			winnerLoot: loot,
			loserLoot: new Bank(),
			solo: true,
			iconPackId: owner.iconPackId
		});
		return {
			content: `${Emoji.ChristmasCracker} You pulled a Christmas cracker with yourself!`,
			files: [image]
		};
	}
	if (otherPersonAPIUser.bot) return "Bot's don't have hands.";
	if (otherPerson.id === owner.id) return 'Nice try.';
	if (!owner.bank.has('Christmas cracker')) {
		return "You don't have any Christmas crackers.";
	}

	await interaction.confirmation(
		`${Emoji.ChristmasCracker} Are you sure you want to use your cracker on them? Either person could get the partyhat! Please confirm if you understand and wish to use it.`
	);

	await owner.removeItemsFromBank(new Bank().add('Christmas cracker', 1));
	const winnerLoot = partyHatTableRoll();
	const loserLoot = JunkTable.roll();
	const [winner, loser] = cryptoRng.shuffle([otherPerson, owner]);
	await winner.addItemsToBank({ items: winnerLoot, collectionLog: true });
	await loser.addItemsToBank({ items: loserLoot, collectionLog: true });
	await addToOpenablesScores(owner, new Bank().add('Christmas cracker', 1).freeze());

	const image = await makeCrackerWhoWonImage({
		ownerName: displayName(owner),
		otherName: displayName(otherPerson),
		winnerName: displayName(winner),
		loserName: displayName(loser),
		winnerLoot,
		loserLoot,
		iconPackId: owner.iconPackId
	});

	return {
		content: `${Emoji.ChristmasCracker} ${owner} pulled a Christmas cracker with ${otherPerson}!`,
		files: [image]
	};
}
