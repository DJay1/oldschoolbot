import { Bank } from 'oldschooljs';

export const DAILY_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type DailyDifficulty = (typeof DAILY_DIFFICULTIES)[number];

/** Easy is the new base: 5x the old typical daily GP, with a small token chance. */
export const DAILY_TIER = {
	easy: {
		label: 'Easy',
		questions: 1,
		correct: { coinMultiplier: 1, xpChance: 20, lootChance: 35 },
		wrong: { coinMultiplier: 0.4, xpChance: 40, lootChance: 65 }
	},
	medium: {
		label: 'Medium',
		success: { coinMultiplier: 2, xpChance: 13, lootChance: 23 },
		fail: { coinMultiplier: 1, xpChance: 20, lootChance: 35 }
	},
	hard: {
		label: 'Hard',
		success: { coinMultiplier: 3, xpChance: 8, lootChance: 13 },
		fail: { coinMultiplier: 0.5, xpChance: 55, lootChance: 80 }
	}
} as const;

export type DailyRate = { coinMultiplier: number; xpChance: number; lootChance: number };

export type DailyOutcome =
	| { difficulty: 'easy'; correct: boolean }
	| { difficulty: 'medium'; success: boolean; game: 'buttons'; detail?: string }
	| {
			difficulty: 'hard';
			success: boolean;
			game: 'wordle' | 'typing' | 'buttons';
			detail?: string;
			wordleHintBonus?: 'none' | 'category' | 'better';
	  };

export function parseDailyDifficulty(input?: string | null): DailyDifficulty {
	const value = input?.trim().toLowerCase();
	if (value === 'medium' || value === 'hard' || value === 'easy') return value;
	return 'easy';
}

export function dailyRatesFor(outcome: DailyOutcome): DailyRate {
	if (outcome.difficulty === 'easy') {
		return outcome.correct ? DAILY_TIER.easy.correct : DAILY_TIER.easy.wrong;
	}
	if (outcome.difficulty === 'medium') {
		return outcome.success ? DAILY_TIER.medium.success : DAILY_TIER.medium.fail;
	}
	return outcome.success ? DAILY_TIER.hard.success : DAILY_TIER.hard.fail;
}

export function dailyOutcomeSummary(outcome: DailyOutcome): string {
	if (outcome.difficulty === 'easy') {
		return outcome.correct ? 'Easy daily' : 'Easy daily (wrong answer)';
	}
	const label = outcome.difficulty === 'medium' ? 'Medium daily' : 'Hard daily';
	const game = outcome.game === 'wordle' ? 'Wordle' : outcome.game === 'typing' ? 'Typing' : 'Speed click';
	if (outcome.success) {
		return outcome.detail ? `${label}: ${game} — ${outcome.detail}` : `${label}: ${game}`;
	}
	return outcome.detail ? `${label}: ${game} failed — ${outcome.detail}` : `${label}: ${game} failed`;
}

export const DOUBLE_XP_TOKEN = 'Double XP token';
export const DOUBLE_LOOT_TOKEN = 'Double loot token';

export function rollDailyRewardTokens(rng: RNGProvider, rates: DailyRate): Bank {
	const tokens = new Bank();
	if (rng.roll(rates.xpChance)) tokens.add(DOUBLE_XP_TOKEN);
	if (rng.roll(rates.lootChance)) tokens.add(DOUBLE_LOOT_TOKEN);
	return tokens;
}

export function dailyTokenWinLines(tokens: Bank): string[] {
	const lines: string[] = [];
	if (tokens.has(DOUBLE_XP_TOKEN)) {
		lines.push(`**${DOUBLE_XP_TOKEN}!** Use it with \`/use item:${DOUBLE_XP_TOKEN}\`.`);
	}
	if (tokens.has(DOUBLE_LOOT_TOKEN)) {
		lines.push(`**${DOUBLE_LOOT_TOKEN}!** Use it with \`/use item:${DOUBLE_LOOT_TOKEN}\`.`);
	}
	return lines;
}

export function dailyRewardBody(outcome: DailyOutcome): string {
	if (outcome.difficulty === 'easy') {
		return outcome.correct
			? "I've picked you some random items as a reward..."
			: "Even though you got it wrong, here's a little reward...";
	}
	// The summary line above already shows the result, so it isn't repeated here.
	if (outcome.success) return "Here's your reward...";
	return outcome.difficulty === 'medium' ? "Here's the Easy-level reward..." : "Here's a smaller reward...";
}

export function buildDailyRewardContent(opts: {
	bonuses: string[];
	outcome: DailyOutcome;
	loot: Bank;
	tokenLines: string[];
	triviaCorrect?: boolean;
}): string {
	const tokenBlock = opts.tokenLines.length > 0 ? `${opts.tokenLines.join('\n')}\n` : '';
	const bonusBlock = opts.bonuses.length > 0 ? `${opts.bonuses.join('\n')}\n` : '';
	const summary = dailyOutcomeSummary(opts.outcome);
	const body = dailyRewardBody(opts.outcome);
	return `${tokenBlock}${bonusBlock}**${summary}**\n${body}\n\nYou received ${opts.loot}`;
}

export function dailyClaimLockWhere(userId: string, previousTimestamp: bigint | number) {
	return {
		user_id: BigInt(userId),
		last_daily_timestamp: BigInt(previousTimestamp)
	};
}

export function messageHasUserPing(content: string): boolean {
	return /<@!?\d+>/.test(content) || content.includes('@everyone') || content.includes('@here');
}

/**
 * Flat Hard Wordle win bonus, after other coin bonuses and after the ironman coin wipe.
 * This replaces the old +50% no-hint multiplier. Mystery boxes are only for no-hint wins.
 * Ironmen get 0 coins (caller passes coins === 0). One daily payout per day (paid flag).
 */
export const WORDLE_HINT_BONUS_COINS = {
	none: 100_000_000,
	category: 50_000_000,
	better: 25_000_000
} as const;

export const WORDLE_NO_HINT_TRADEABLE_BOXES = 1;
export const WORDLE_NO_HINT_UNTRADEABLE_BOXES = 1;

export function wordleHintBonusLine(tier: 'none' | 'category' | 'better', awardedCoins: number): string {
	const gp = WORDLE_HINT_BONUS_COINS[tier].toLocaleString('en-US');
	if (tier === 'none') {
		const boxes = '+1 Tradeable Mystery Box, +1 Untradeable Mystery Box';
		if (awardedCoins > 0) return `No hint bonus: +${gp} coins, ${boxes}!`;
		return `No hint bonus: ${boxes}! Ironmen don't receive the coin bonus.`;
	}
	if (awardedCoins <= 0) return '';
	return tier === 'category' ? `Category hint bonus: +${gp} coins.` : `Better hint bonus: +${gp} coins.`;
}

export function applyWordleHintBonus(
	loot: Bank,
	coins: number,
	tier: 'none' | 'category' | 'better'
): { coins: number; line: string } {
	const awardedCoins = coins > 0 ? WORDLE_HINT_BONUS_COINS[tier] : 0;
	if (tier === 'none') {
		loot.add('Tradeable Mystery Box', WORDLE_NO_HINT_TRADEABLE_BOXES);
		loot.add('Untradeable Mystery Box', WORDLE_NO_HINT_UNTRADEABLE_BOXES);
	}
	return { coins: coins + awardedCoins, line: wordleHintBonusLine(tier, awardedCoins) };
}
