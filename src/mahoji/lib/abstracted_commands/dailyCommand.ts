import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';

import { Emoji, formatDuration, isWeekend, Time, uniqueArr } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import { bscDailyCooldownMs } from '@/lib/bsc/patronTiers.js';
import { CONSTANTS } from '@/lib/constants.js';
import { isEventActive } from '@/lib/events/registry.js';
import { getRandomTriviaQuestions } from '@/lib/roboChimp.js';
import dailyRoll from '@/lib/simulation/dailyTable.js';

/** 1 in this many dailies hits the rare roll. Half of those rolls pay the jackpot. */
export const DAILY_RARE_ROLL = 1_000;
export const DAILY_JACKPOT_GP = 1_000_000_000;
/** The other half of the rare roll. About a tenth of the jackpot, plus a few boxes. */
export const DAILY_CONSOLATION_GP = 100_000_000;
export const DAILY_CONSOLATION_ITEMS = new Bank()
	.add('Tradeable Mystery Box')
	.add('Untradeable Mystery Box')
	.add('Equippable mystery box')
	.freeze();
export const DAILY_CONSOLATION_LINE = '✨ The sparkle fizzled, so Diango stuffed a smaller prize in the bag.';

export async function isUsersDailyReady(
	user: MUser
): Promise<{ isReady: true } | { isReady: false; durationUntilReady: number }> {
	const stats = await user.fetchStats();
	const currentDate = Date.now();
	const lastVoteDate = Number(stats.last_daily_timestamp);
	const difference = currentDate - lastVoteDate;

	const baseCooldown = bscDailyCooldownMs(user.bitfield, CONSTANTS.DAILY_COOLDOWN);
	// Launch event: dailies every 12 hours at most.
	const dailyCooldown = isEventActive('launch') ? Math.min(baseCooldown, Time.Hour * 12) : baseCooldown;
	if (difference < dailyCooldown) {
		const duration = Date.now() - (lastVoteDate + dailyCooldown);
		return { isReady: false, durationUntilReady: duration };
	}

	return { isReady: true };
}

async function reward(rng: RNGProvider, user: MUser, triviaCorrect: boolean): Promise<MessageBuilderClass> {
	const member = await globalClient.fetchMainServerMember(user.id);

	const loot = dailyRoll(1, triviaCorrect);

	const bonuses = [];

	let coinsToGive = loot.amount('Coins');

	if (isWeekend()) {
		coinsToGive *= 2;
		bonuses.push(Emoji.MoneyBag);
	}

	if (member) {
		coinsToGive = Math.floor(coinsToGive * 1.5);
		bonuses.push(Emoji.OSBot);
	}

	if (user.hasMinion) {
		coinsToGive /= 1.5;
	}

	if (rng.roll(73)) {
		coinsToGive = Math.floor(coinsToGive * 1.73);
		bonuses.push(Emoji.Joy);
	}

	if (rng.roll(DAILY_RARE_ROLL)) {
		if (rng.roll(2)) {
			coinsToGive += DAILY_CONSOLATION_GP;
			loot.add(DAILY_CONSOLATION_ITEMS);
			bonuses.push(DAILY_CONSOLATION_LINE);
		} else {
			coinsToGive += DAILY_JACKPOT_GP;
			bonuses.push(Emoji.Diamond);
		}
	}

	if (!triviaCorrect) {
		coinsToGive = Math.floor(coinsToGive * 0.4);
	}

	const hasSkipper = user.usingPet('Skipper') || user.bank.has('Skipper');
	if (hasSkipper && coinsToGive > 0) {
		coinsToGive = Math.floor(coinsToGive * 1.5);
		bonuses.push(`${BSOEmoji.Skipper} Skipper negotiated you 50% more coins!`);
	}

	if (isEventActive('launch')) {
		let tripled = false;
		for (const [item, qty] of loot.items()) {
			if (/mystery box/i.test(item.name)) {
				loot.add(item.id, qty * 2);
				tripled = true;
			}
		}
		if (tripled) bonuses.push('🎉 Launch event: your mystery boxes were tripled!');
	}

	if (user.isIronman) {
		coinsToGive = 0;
	}

	loot.set('Coins', Math.floor(coinsToGive));

	const correct = triviaCorrect ? 'correct' : 'incorrect';
	const reward = triviaCorrect
		? "I've picked you some random items as a reward..."
		: "Even though you got it wrong, here's a little reward...";

	const dmStr = `${bonuses.join('')} **${Emoji.Diango} Diango says..** That's ${correct}! ${reward}\n`;

	if (coinsToGive) {
		ClientSettings.updateClientGPTrackSetting('gp_daily', coinsToGive);
	}

	const { itemsAdded, previousCL } = await user.transactItems({
		collectionLog: true,
		itemsToAdd: loot
	});

	return new MessageBuilder().setContent(`${dmStr}\nYou received ${loot}`).addBankImage({
		bank: itemsAdded,
		title: `Daily Loot`,
		previousCL,
		showNewCL: true,
		user
	});
}

export async function dailyCommand(rng: RNGProvider, interaction: MInteraction, user: MUser): CommandResponse {
	const check = await isUsersDailyReady(user);
	if (!check.isReady) {
		return `**${Emoji.Diango} Diango says...** You can claim your next daily in ${formatDuration(
			check.durationUntilReady
		)}.`;
	}

	await user.statsUpdate({
		last_daily_timestamp: Date.now()
	});

	const [question, ...fakeQuestions] = await getRandomTriviaQuestions();
	if (!question) return reward(rng, user, true);
	const allAnswers = uniqueArr(rng.shuffle([question, ...fakeQuestions].map(q => q.answers[0])));

	const choice = await globalClient.pickStringWithButtons({
		interaction,
		options: allAnswers.map(answer => ({ label: answer, id: answer })),
		content: `**${Emoji.Diango} Diango asks ${user.badgedUsername}...** ${question.question}`
	});
	if (!choice) return reward(rng, user, false);
	return reward(rng, user, question.answers.includes(choice.choice.label!));
}
