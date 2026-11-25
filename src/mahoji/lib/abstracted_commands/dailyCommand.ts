import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';

import {
	type APIInteraction,
	ButtonBuilder,
	ButtonStyle,
	createInteractionCollector,
	InteractionResponseType,
	InteractionType,
	Routes
} from '@oldschoolgg/discord';
import { Emoji, formatDuration, isWeekend, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';
import {
	applyButtonAction,
	applyTypingGuess,
	applyWordleAction,
	betterHintRemainingMs,
	buttonGameRows,
	createButtonGameState,
	createHardGame,
	DAILY_TIMEOUT_NOTICE,
	extractModalText,
	formatButtonGameMessage,
	formatTypingMessage,
	formatWordleMessage,
	type HardGameState,
	hardGameTimeoutMs,
	isDailyHardModalId,
	isDailyTypingButton,
	isDailyWordleGuessButton,
	isDailyWordleHintButton,
	isUnstartedTimedDaily,
	parseButtonAction,
	renderTypingPromptImage,
	showDailyGameModal,
	typingGameRows,
	typingModalSpec,
	wordleGuessRows,
	wordleModalSpec
} from '@/lib/bsc/dailyGames.js';
import {
	clearDailyPending,
	createDailySettle,
	type DailyPendingRow,
	isDailyPendingExpired,
	loadDailyPending,
	markDailyPendingPaid,
	remainingMs,
	resolveDailyPendingPayout,
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
import { isDailyTriviaAnswerCorrect, pickDailyTrivia } from '@/lib/bsc/dailyTrivia.js';
import { bscDailyCooldownMs } from '@/lib/bsc/patronTiers.js';
import { CONSTANTS } from '@/lib/constants.js';
import { isEventActive } from '@/lib/events/registry.js';
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
	return outcome.success;
}

function buttonsFromSpec(rows: { id: string; label: string }[][]): ButtonBuilder[][] {
	return rows.map(row =>
		row.map(spec =>
			new ButtonBuilder().setCustomId(spec.id).setStyle(ButtonStyle.Secondary).setLabel(spec.label.slice(0, 80))
		)
	);
}

async function hardGameContent(
	game: HardGameState,
	expiresAt: number
): Promise<{ content: string; components: ButtonBuilder[][]; files?: { buffer: Buffer; name: string }[] }> {
	const left = remainingMs(expiresAt);
	if (game.type === 'wordle') {
		return {
			content: formatWordleMessage(game, left),
			components: game.status === 'playing' ? buttonsFromSpec(wordleGuessRows(game)) : []
		};
	}
	if (game.type === 'buttons') {
		return {
			content: formatButtonGameMessage(game, left),
			components: game.status === 'playing' ? buttonsFromSpec(buttonGameRows(game)) : []
		};
	}
	if (game.status === 'playing') {
		const buffer = await renderTypingPromptImage(game);
		return {
			content: formatTypingMessage(game, left),
			components: buttonsFromSpec(typingGameRows()),
			files: [{ buffer, name: 'prompt.png' }]
		};
	}
	return {
		content: formatTypingMessage(game, left),
		components: []
	};
}

async function respondModalUpdate(
	itx: APIInteraction,
	view: { content: string; components: ButtonBuilder[][] }
): Promise<void> {
	await globalClient.rest.post(Routes.interactionCallback(itx.id, itx.token), {
		auth: false,
		body: {
			type: InteractionResponseType.UpdateMessage,
			data: {
				content: view.content,
				components: view.components.map(row => ({
					type: 1,
					components: row.map(button => button.toJSON())
				})),
				attachments: []
			}
		}
	});
}

async function payHardOutcome(
	rng: RNGProvider,
	user: MUser,
	_pending: DailyPendingRow,
	game: HardGameState,
	timedOut = false
): Promise<MessageBuilderClass | null> {
	const allowed = await markDailyPendingPaid(user.id);
	if (!allowed) return null;
	const success = game.status === 'won' && !timedOut;
	const detail = timedOut ? DAILY_TIMEOUT_NOTICE : game.notice;
	if (_pending.difficulty === 'medium') {
		return giveDailyReward(rng, user, { difficulty: 'medium', success, game: 'buttons', detail });
	}
	return giveDailyReward(rng, user, {
		difficulty: 'hard',
		success,
		game: game.type === 'typing' ? 'typing' : 'wordle',
		detail
	});
}

async function restoreUnstartedHardDaily(user: MUser, difficulty: 'medium' | 'hard' = 'hard'): Promise<string> {
	await clearDailyPending(user.id);
	await user.statsUpdate({ last_daily_timestamp: 0 });
	const label = difficulty === 'medium' ? 'Medium' : 'Hard';
	return `The ${label} daily didn't start, so you weren't charged a daily. Try \`/minion daily difficulty:${label}\` again.`;
}

async function playHardGame(
	rng: RNGProvider,
	interaction: MInteraction,
	user: MUser,
	pending: DailyPendingRow
): Promise<CommandResponse> {
	let game = pending.game;
	let expiresAt = pending.expiresAt;
	const alreadyFinished = resolveDailyPendingPayout({ ...pending, game, expiresAt });
	if (alreadyFinished.game.status !== 'playing') {
		return (
			(await payHardOutcome(rng, user, pending, alreadyFinished.game, alreadyFinished.timedOut)) ??
			'You already finished this daily.'
		);
	}

	await interaction.defer();
	let first: Awaited<ReturnType<typeof hardGameContent>>;
	try {
		first = await hardGameContent(game, expiresAt);
	} catch {
		return restoreUnstartedHardDaily(user, pending.difficulty);
	}
	const rowsValid = first.components.length === 0 || first.components.every(row => row.length > 0 && row.length <= 5);
	const typingImageMissing = game.type === 'typing' && game.status === 'playing' && !first.files?.length;
	if (!rowsValid || typingImageMissing) {
		return restoreUnstartedHardDaily(user, pending.difficulty);
	}
	const msg = await interaction.replyWithResponse({
		content: first.content,
		components: first.components,
		files: first.files,
		withResponse: true
	});
	if (!msg?.message_id) {
		return restoreUnstartedHardDaily(user, pending.difficulty);
	}

	if (game.status !== 'playing') {
		return (await payHardOutcome(rng, user, pending, game)) ?? 'You already finished this daily.';
	}

	const freshStart =
		game.status === 'playing' &&
		remainingMs(expiresAt) >= hardGameTimeoutMs(game) - 2000 &&
		((game.type === 'wordle' && game.rows.length === 0) ||
			(game.type === 'buttons' && game.progress === 0) ||
			game.type === 'typing');
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

		const cleanupModal = () => {
			globalClient.removeListener('interactionCreate', onModalSubmit);
		};

		const settle = createDailySettle();
		let betterHintTimeout: ReturnType<typeof setTimeout> | undefined;
		const clearBetterHintTimeout = () => {
			if (betterHintTimeout) {
				clearTimeout(betterHintTimeout);
				betterHintTimeout = undefined;
			}
		};
		const armBetterHintTimeout = () => {
			clearBetterHintTimeout();
			const left = remainingMs(expiresAt);
			if (left <= 0) return;
			betterHintTimeout = setTimeout(() => {
				if (game.status !== 'playing') return;
				void finish({ ...game, status: 'lost', notice: DAILY_TIMEOUT_NOTICE }, true);
			}, left);
		};
		const finish = async (finalGame: HardGameState, timedOut = false) => {
			if (!settle.tryBegin()) return;
			clearBetterHintTimeout();
			cleanupModal();
			collector.stop('finished');
			try {
				const result = await payHardOutcome(rng, user, pending, finalGame, timedOut);
				if (result) resolve(result);
			} catch (err) {
				reject(err);
			}
		};

		const onModalSubmit = async (itx: APIInteraction) => {
			try {
				if (itx.type !== InteractionType.ModalSubmit) return;
				if (!isDailyHardModalId(itx.data.custom_id)) return;
				const submitter = itx.member?.user.id ?? itx.user?.id;
				if (submitter !== user.id) return;
				if (itx.message?.id && msg?.message_id && itx.message.id !== msg.message_id) return;
				if (isDailyPendingExpired(expiresAt) || game.status !== 'playing') {
					game = { ...game, status: 'lost', notice: DAILY_TIMEOUT_NOTICE };
					const view = await hardGameContent(game, expiresAt);
					await respondModalUpdate(itx, view);
					return finish(game, true);
				}
				const typed = extractModalText(itx);
				if (game.type === 'wordle' && itx.data.custom_id === wordleModalSpec().customId) {
					game = applyWordleAction(game, { kind: 'submit', guess: typed });
				} else if (game.type === 'typing' && itx.data.custom_id === typingModalSpec().customId) {
					game = applyTypingGuess(game, typed);
				} else {
					return;
				}
				await updateDailyPendingGame(user.id, game, expiresAt);
				const view = await hardGameContent(game, expiresAt);
				await respondModalUpdate(itx, view);
				if (game.status !== 'playing') {
					return finish(game);
				}
			} catch (err) {
				cleanupModal();
				collector.stop('error');
				reject(err);
			}
		};

		globalClient.addListener('interactionCreate', onModalSubmit);

		let clickQueue: Promise<void> = Promise.resolve();
		collector.on('collect', button => {
			const run = clickQueue.then(() => handleSpeedClick(button));
			clickQueue = run.then(
				() => undefined,
				() => undefined
			);
			return run;
		});

		async function handleSpeedClick(button: MInteraction) {
			try {
				if (isDailyPendingExpired(expiresAt)) {
					await button.silentButtonAck().catch(() => undefined);
					return finish({ ...game, status: 'lost', notice: DAILY_TIMEOUT_NOTICE }, true);
				}
				const customId = button.customId ?? '';
				if (
					(game.type === 'wordle' && isDailyWordleGuessButton(customId)) ||
					(game.type === 'typing' && isDailyTypingButton(customId))
				) {
					try {
						await showDailyGameModal(
							globalClient.rest,
							button,
							game.type === 'wordle' ? wordleModalSpec() : typingModalSpec()
						);
					} catch {
						if (isUnstartedTimedDaily(game)) {
							cleanupModal();
							collector.stop('error');
							resolve(await restoreUnstartedHardDaily(user, pending.difficulty));
							return;
						}
						throw new Error('Failed to open the daily typing box.');
					}
					return;
				}
				if (game.type === 'wordle' && isDailyWordleHintButton(customId)) {
					try {
						await button.baseDeferUpdate();
					} catch {
						// Already acknowledged; still apply the hint and edit if we can.
					}
					const before = game;
					game = applyWordleAction(game, { kind: 'hint' });
					if (
						before.type === 'wordle' &&
						game.type === 'wordle' &&
						!before.betterHintRevealed &&
						game.betterHintRevealed
					) {
						expiresAt = Date.now() + betterHintRemainingMs(remainingMs(expiresAt));
						armBetterHintTimeout();
					}
					await updateDailyPendingGame(user.id, game, expiresAt);
					const view = await hardGameContent(game, expiresAt);
					try {
						if (button.deferred || button.replied) {
							await button.baseEditReply({ content: view.content, components: view.components });
						} else {
							await button.update({ content: view.content, components: view.components });
						}
					} catch {
						// The hint is already saved. Don't fail the command over a stale token.
					}
					return;
				}
				if (game.type !== 'buttons') {
					await button.silentButtonAck().catch(() => undefined);
					return;
				}
				const index = parseButtonAction(customId);
				if (index === null) {
					await button.silentButtonAck().catch(() => undefined);
					return;
				}
				// Ack first so a later database write cannot miss Discord's 3s window.
				try {
					await button.baseDeferUpdate();
				} catch {
					// Already acknowledged; still apply the click and edit if we can.
				}
				game = applyButtonAction(game, index);
				await updateDailyPendingGame(user.id, game, expiresAt);
				const view = await hardGameContent(game, expiresAt);
				try {
					if (button.deferred || button.replied) {
						await button.baseEditReply({ content: view.content, components: view.components });
					} else {
						await button.update({ content: view.content, components: view.components });
					}
				} catch {
					// The click is already saved. Don't fail the command over a stale token.
				}
				if (game.status !== 'playing') {
					return finish(game);
				}
			} catch (err) {
				cleanupModal();
				if (game.status !== 'playing') {
					return finish(game);
				}
				collector.stop('error');
				if (isUnstartedTimedDaily(game)) {
					resolve(await restoreUnstartedHardDaily(user, pending.difficulty));
					return;
				}
				resolve(DAILY_GAME_UPDATE_FAILED);
			}
		}

		collector.on('end', async (_collected, reason) => {
			if (reason === 'finished' || reason === 'error') {
				cleanupModal();
				return;
			}
			cleanupModal();
			if (game.status === 'playing') {
				game = { ...game, status: 'lost', notice: DAILY_TIMEOUT_NOTICE };
				await finish(game, true);
			}
		});
	});
}

async function playTrivia(rng: RNGProvider, interaction: MInteraction, user: MUser): Promise<CommandResponse> {
	const questions = pickDailyTrivia(rng, 'easy', 1);
	const question = questions[0];
	const choice = await globalClient.pickStringWithButtons({
		interaction,
		options: question.choices.map(answer => ({ label: String(answer).slice(0, 80), id: String(answer) })),
		content: `**${Emoji.Diango} Diango asks...** ${question.question}`
	});
	return giveDailyReward(rng, user, {
		difficulty: 'easy',
		correct: isDailyTriviaAnswerCorrect(question, choice?.choice.id ?? choice?.choice.label)
	});
}

export const DAILY_DIFFICULTY_PROMPT = `**${Emoji.Diango} Diango says...** Pick a daily: Easy is trivia, Medium is a 20-second speed click, and Hard is a typed Wordle or an item-sprite typing challenge.`;
export const DAILY_DIFFICULTY_CANCELLED = `**${Emoji.Diango} Diango says...** You didn't pick a daily, so you weren't charged.`;
export const DAILY_GAME_UPDATE_FAILED = `**${Emoji.Diango} Diango says...** Something went wrong updating the game. Use \`/minion daily\` to keep going. You weren't charged twice.`;

export function shouldShowDailyDifficultyPicker(input?: string | null): boolean {
	return input === undefined || input === null || input.trim() === '';
}

async function pickDailyDifficultyThenPlay(rng: RNGProvider, interaction: MInteraction, user: MUser): CommandResponse {
	const choice = await globalClient.pickStringWithButtons({
		interaction,
		options: [
			{ label: 'Easy', id: 'easy' },
			{ label: 'Medium', id: 'medium' },
			{ label: 'Hard', id: 'hard' }
		],
		content: DAILY_DIFFICULTY_PROMPT
	});
	if (!choice) return DAILY_DIFFICULTY_CANCELLED;
	return dailyCommand(rng, interaction, user, choice.choice.id);
}

export async function dailyCommand(
	rng: RNGProvider,
	interaction: MInteraction,
	user: MUser,
	difficultyInput?: string
): CommandResponse {
	const pending = await loadDailyPending(user.id);
	if (pending && !pending.paid) {
		const payout = resolveDailyPendingPayout(pending);
		if (payout.game.status === 'playing') {
			return playHardGame(rng, interaction, user, pending);
		}
		return (
			(await payHardOutcome(rng, user, pending, payout.game, payout.timedOut)) ??
			'You already finished this daily.'
		);
	}

	if (shouldShowDailyDifficultyPicker(difficultyInput)) {
		const ready = await isUsersDailyReady(user);
		if (!ready.isReady) return cooldownReply(ready.durationUntilReady);
		return pickDailyDifficultyThenPlay(rng, interaction, user);
	}

	const difficulty: DailyDifficulty = parseDailyDifficulty(difficultyInput);
	const claim = await tryClaimDaily(user);
	if (!claim.ok) {
		return cooldownReply(claim.durationUntilReady);
	}

	if (difficulty === 'easy') return playTrivia(rng, interaction, user);

	const timedDifficulty = difficulty === 'medium' ? 'medium' : 'hard';
	const game = timedDifficulty === 'medium' ? createButtonGameState(rng) : createHardGame(rng);
	const claimedAt = Date.now();
	const pendingRow: DailyPendingRow = {
		userId: user.id,
		claimedAt,
		difficulty: timedDifficulty,
		game,
		expiresAt: claimedAt + hardGameTimeoutMs(game),
		paid: false
	};
	await saveDailyPending(pendingRow);
	return playHardGame(rng, interaction, user, pendingRow);
}

export { parseDailyDifficulty };
