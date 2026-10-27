import { isAtleastThisOld, Time } from '@oldschoolgg/toolkit';
import { DiscordSnowflake } from '@sapphire/snowflake';
import { Bank } from 'oldschooljs';

import { fetchUserStats } from '@/lib/util/fetchUserStats.js';

export async function minionBuyCommand(user: MUser, ironman: boolean): CommandResponse {
	if (user.hasMinion) return 'You already have a minion!';

	await user.update({
		minion_hasBought: true,
		minion_bought_date: new Date(),
		minion_ironman: Boolean(ironman)
	});

	const createdAt = DiscordSnowflake.timestampFrom(user.id);
	const starter = isAtleastThisOld(createdAt, Time.Year * 2)
		? new Bank({
				Shark: 300,
				'Saradomin brew(4)': 50,
				'Super restore(4)': 20,
				'Anti-dragon shield': 1,
				'Tiny lamp': 5,
				'Small lamp': 2,
				'Tradeable mystery box': 5,
				'Untradeable Mystery box': 5,
				'Dragon bones': 50,
				Coins: 50_000_000,
				'Clue scroll (beginner)': 10,
				'Equippable mystery box': 1,
				'Pet Mystery box': 1
			})
		: null;

	if (starter) {
		await user.addItemsToBank({ items: starter, collectionLog: false });
	}
	// Ensure user has a userStats row
	await fetchUserStats(user.id);

	return {
		content: `You have successfully got yourself a minion, and you're ready to use **NEED TO REPLACE** now!

You can make your new minion an Ironman by using the command: \`/minion ironman\`.

${starter !== null ? `**You received these starter items:** ${starter}.` : ''}`
	};
}
