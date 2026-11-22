import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';

import { ButtonBuilder, ButtonStyle, createInteractionCollector } from '@oldschoolgg/discord';
import { Emoji, formatDuration, isWeekend, Time, uniqueArr } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import {
	applyButtonAction,
	applyWordleAction,
	buttonGameSpec,
	createHardGame,
	formatButtonGameMessage,
	formatWordleMessage,
	type HardGameState,
	hardGameTimeoutMs,
	parseButtonAction,
	parseWordleAction,
	wordleKeyboardSpec
} from '@/lib/bsc/dailyGames.js';
import {
	type DailyPendingRow,
	isDailyPendingExpired,
	loadDailyPending,
	markDailyPendingPaid,
	remainingMs,
	saveDailyPending,
	updateDailyPendingGame
} from '@/lib/bsc/dailyPending.js';
import {
	buildDailyRewardContent,
	type DailyDifficulty,
	type DailyOutcome,
	dailyClaimLockWhere,
	dailyRatesFor,
	dailyTokenWinLines,
	parseDailyDifficulty,
	rollDailyRewardTokens
} from '@/lib/bsc/dailyRewards.js';
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

function dailyCooldownMs(user: MUser): number {
	const baseCooldown = bscDailyCooldownMs(user.bitfield, CONSTANTS.DAILY_COOLDOWN);
	// Launch event: dailies every 12 hours at most.
	return isEventActive('launch') ? Math.min(baseCooldown, Time.Hour * 12) : baseCooldown;
}

export async function isUsersDailyReady(
	user: MUser
): Promise<{ isReady: true } | { isReady: false; durationUntilReady: number }> {
	const stats = await user.fetchStats();
	const currentDate = Date.now();
	const lastVoteDate = Number(stats.last_daily_timestamp);
	const difference = currentDate - lastVoteDate;
	const cooldown = dailyCooldownMs(user);
	if (difference < cooldown) {
		const duration = Date.now() - (lastVoteDate + cooldown);
		return { isReady: false, durationUntilReady: duration };
	}
	return { isReady: true };
}

export async function tryClaimDaily(user: MUser): Promise<{ ok: true } | { ok: false; durationUntilReady: number }> {
	const stats = await user.fetchStats();
	const lastVoteDate = Number(stats.last_daily_timestamp);
	const cooldown = dailyCooldownMs(user);
	if (Date.now() - lastVoteDate < cooldown) {
		return { ok: false, durationUntilReady: Date.now() - (lastVoteDate + cooldown) };
	}

	const result = await prisma.userStats.updateMany({
		where: dailyClaimLockWhere(user.id, stats.last_daily_timestamp),
		data: { last_daily_timestamp: Date.now() }
	});
	if (result.count !== 1) {
		const retry = await isUsersDailyReady(user);
		if (!retry.isReady) return { ok: false, durationUntilReady: retry.durationUntilReady };
		return { ok: false, durationUntilReady: 0 };
	}
	return { ok: true };
}

function cooldownReply(durationUntilReady: number): string {
	return `**${Emoji.Diango} Diango says...** You can claim your next daily in ${formatDuration(durationUntilReady)}.`;
}

async function giveDailyReward(rng: RNGProvider, user: MUser, outcome: DailyOutcome): Promise<MessageBuilderClass> {
	const member = await globalClient.fetchMainServerMember(user.id);
	const loot = dailyRoll(1, triviaSucceeded(outcome));
	const rates = dailyRatesFor(outcome);
	const bonuses: string[] = [];

	let coinsToGive = loot.amount('Coins');
	coinsToGive = Math.floor(coinsToGive * rates.coinMultiplier);

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

	const tokens = rollDailyRewardTokens(rng, rates);
	if (tokens.items().length > 0) loot.add(tokens);

	if (coinsToGive) {
		ClientSettings.updateClientGPTrackSetting('gp_daily', coinsToGive);
	}

	const { itemsAdded, previousCL } = await user.transactItems({
		collectionLog: true,
		itemsToAdd: loot
	});

	const content = buildDailyRewardContent({
		bonuses,
		outcome,
		loot,
		tokenLines: dailyTokenWinLines(tokens),
		triviaCorrect: triviaSucceeded(outcome)
	});

	return new MessageBuilder().setContent(`**${Emoji.Diango} Diango says..** ${content}`).addBankImage({
		bank: itemsAdded,
		title: 'Daily Loot',
		previousCL,
		showNewCL: true,
		user
	});
}

function triviaSucceeded(outcome: DailyOutcome): boolean {
	if (outcome.difficulty === 'easy') return outcome.correct;
	if (outcome.difficulty === 'medium') return outcome.correctCount >= 2;
	return outcome.success;
}

function buttonsFromSpec(rows: { id: string; label: string }[][]): ButtonBuilder[][] {
	return rows.map(row =>
		row.map(spec =>
			new ButtonBuilder().setCustomId(spec.id).setStyle(ButtonStyle.Secondary).setLabel(spec.label.slice(0, 80))
		)
	);
}

function hardGameContent(game: HardGameState, expiresAt: number): { content: string; components: ButtonBuilder[][] } {
	const left = remainingMs(expiresAt);
	if (game.type === 'wordle') {
		return {
			content: formatWordleMessage(game, left),
			components: game.status === 'playing' ? buttonsFromSpec(wordleKeyboardSpec(game.page)) : []
		};
	}
	return {
		content: formatButtonGameMessage(game, left),
		components:
			game.status === 'playing'
				? [
						buttonGameSpec(game).map(spec =>
							new ButtonBuilder()
								.setCustomId(spec.id)
								.setStyle(ButtonStyle.Secondary)
								.setLabel(spec.label.slice(0, 80))
						)
					]
				: []
	};
}

async function payHardOutcome(
	rng: RNGProvider,
	user: MUser,
	_pending: DailyPendingRow,
	game: HardGameState,
	timedOut = false
): Promise<MessageBuilderClass> {
	const allowed = await markDailyPendingPaid(user.id);
	if (!allowed) {
		return new MessageBuilder().setContent('You already finished this daily.');
	}
	const success = game.status === 'won' && !timedOut;
	const detail = timedOut ? 'You ran out of time.' : game.type === 'wordle' ? game.notice : game.notice;
	return giveDailyReward(rng, user, {
		difficulty: 'hard',
		success,
		game: game.type,
		detail
	});
}

async function playHardGame(
	rng: RNGProvider,
	interaction: MInteraction,
	user: MUser,
	pending: DailyPendingRow
): Promise<CommandResponse> {
	let game = pending.game;
	let expiresAt = pending.expiresAt;
	if (isDailyPendingExpired(expiresAt) && game.status === 'playing') {
		game = { ...game, status: 'lost', notice: 'You ran out of time.' };
		return payHardOutcome(rng, user, pending, game, true);
	}

	await interaction.defer();
	const first = hardGameContent(game, expiresAt);
	const msg = await interaction.replyWithResponse({
		content: first.content,
		components: first.components,
		withResponse: true
	});

	if (game.status !== 'playing') {
		return payHardOutcome(rng, user, pending, game);
	}

	const freshStart =
		game.status === 'playing' &&
		remainingMs(expiresAt) >= hardGameTimeoutMs(game) - 2000 &&
		((game.type === 'wordle' && game.rows.length === 0 && game.input === '') ||
			(game.type === 'buttons' && game.progress === 0));
	if (freshStart) {
		// Timer starts when the game message is shown, not when the claim was written.
		expiresAt = Date.now() + hardGameTimeoutMs(game);
		await updateDailyPendingGame(user.id, game, expiresAt);
	}

	return new Promise((resolve, reject) => {
		const collector = createInteractionCollector({
			interaction,
			messageId: msg?.message_id,
			channelId: interaction.channelId,
			users: [user.id],
			maxCollected: 80,
			timeoutMs: remainingMs(expiresAt)
		});

		const finish = async (finalGame: HardGameState, timedOut = false) => {
			collector.stop('finished');
			try {
				resolve(await payHardOutcome(rng, user, pending, finalGame, timedOut));
			} catch (err) {
				reject(err);
			}
		};

		collector.on('collect', async button => {
			try {
				if (isDailyPendingExpired(expiresAt)) {
					await button.silentButtonAck();
					return finish({ ...game, status: 'lost', notice: 'You ran out of time.' }, true);
				}
				const customId = button.customId ?? '';
				let next: HardGameState | null = null;
				if (game.type === 'wordle') {
					const action = parseWordleAction(customId);
					if (!action) {
						await button.silentButtonAck();
						return;
					}
					next = applyWordleAction(game, action);
				} else {
					const index = parseButtonAction(customId);
					if (index === null) {
						await button.silentButtonAck();
						return;
					}
					next = applyButtonAction(game, index);
				}
				game = next;
				await updateDailyPendingGame(user.id, game, expiresAt);
				const view = hardGameContent(game, expiresAt);
				await button.update({ content: view.content, components: view.components });
				if (game.status !== 'playing') {
					return finish(game);
				}
			} catch (err) {
				collector.stop('error');
				reject(err);
			}
		});

		collector.on('end', async (_collected, reason) => {
			if (reason === 'finished' || reason === 'error') return;
			try {
				if (game.status === 'playing') {
					game = { ...game, status: 'lost', notice: 'You ran out of time.' };
					resolve(await payHardOutcome(rng, user, pending, game, true));
				}
			} catch (err) {
				reject(err);
			}
		});
	});
}

async function playTrivia(
	rng: RNGProvider,
	interaction: MInteraction,
	user: MUser,
	questionsNeeded: number
): Promise<CommandResponse> {
	let correctCount = 0;
	for (let i = 0; i < questionsNeeded; i++) {
		const [question, ...fakeQuestions] = await getRandomTriviaQuestions();
		if (!question) {
			correctCount += 1;
			continue;
		}
		const allAnswers = uniqueArr(rng.shuffle([question, ...fakeQuestions].map(q => q.answers[0])));
		const prefix = questionsNeeded > 1 ? `Question ${i + 1}/${questionsNeeded}. ` : '';
		const choice = await globalClient.pickStringWithButtons({
			interaction,
			options: allAnswers.map(answer => ({ label: String(answer).slice(0, 80), id: String(answer) })),
			content: `**${Emoji.Diango} Diango asks...** ${prefix}${question.question}`
		});
		if (choice && question.answers.includes(choice.choice.label!)) {
			correctCount += 1;
		}
	}

	if (questionsNeeded === 1) {
		return giveDailyReward(rng, user, { difficulty: 'easy', correct: correctCount === 1 });
	}
	return giveDailyReward(rng, user, { difficulty: 'medium', correctCount, total: 3 });
}

export async function dailyCommand(
	rng: RNGProvider,
	interaction: MInteraction,
	user: MUser,
	difficultyInput?: string
): CommandResponse {
	const difficulty: DailyDifficulty = parseDailyDifficulty(difficultyInput);

	const pending = await loadDailyPending(user.id);
	if (pending && !pending.paid) {
		if (!isDailyPendingExpired(pending.expiresAt) && pending.game.status === 'playing') {
			return playHardGame(rng, interaction, user, pending);
		}
		if (pending.game.status === 'playing') {
			pending.game = { ...pending.game, status: 'lost', notice: 'You ran out of time.' };
		}
		return payHardOutcome(rng, user, pending, pending.game, isDailyPendingExpired(pending.expiresAt));
	}

	const claim = await tryClaimDaily(user);
	if (!claim.ok) {
		return cooldownReply(claim.durationUntilReady);
	}

	if (difficulty === 'easy') return playTrivia(rng, interaction, user, 1);
	if (difficulty === 'medium') return playTrivia(rng, interaction, user, 3);

	const game = createHardGame(rng);
	const claimedAt = Date.now();
	const pendingRow: DailyPendingRow = {
		userId: user.id,
		claimedAt,
		difficulty: 'hard',
		game,
		expiresAt: claimedAt + hardGameTimeoutMs(game),
		paid: false
	};
	await saveDailyPending(pendingRow);
	return playHardGame(rng, interaction, user, pendingRow);
}

export { parseDailyDifficulty };
