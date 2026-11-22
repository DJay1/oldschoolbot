import { Bank } from 'oldschooljs';

export const DAILY_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type DailyDifficulty = (typeof DAILY_DIFFICULTIES)[number];

/** Easy is the new base: 5x the old typical daily GP, with a small token chance. */
export const DAILY_TIER = {
	easy: {
		label: 'Easy',
		questions: 1,
		correct: { coinMultiplier: 1, xpChance: 30, lootChance: 50 },
		wrong: { coinMultiplier: 0.4, xpChance: 60, lootChance: 100 }
	},
	medium: {
		label: 'Medium',
		questions: 3,
		allCorrect: { coinMultiplier: 2, xpChance: 20, lootChance: 35 },
		twoCorrect: { coinMultiplier: 1.5, xpChance: 25, lootChance: 40 },
		oneCorrect: { coinMultiplier: 1, xpChance: 30, lootChance: 50 },
		noneCorrect: { coinMultiplier: 0.4, xpChance: 60, lootChance: 100 }
	},
	hard: {
		label: 'Hard',
		success: { coinMultiplier: 3, xpChance: 12, lootChance: 20 },
		fail: { coinMultiplier: 0.5, xpChance: 80, lootChance: 120 }
	}
} as const;

export type DailyRate = { coinMultiplier: number; xpChance: number; lootChance: number };

export type DailyOutcome =
	| { difficulty: 'easy'; correct: boolean }
	| { difficulty: 'medium'; correctCount: number; total: 3 }
	| { difficulty: 'hard'; success: boolean; game: 'wordle' | 'buttons'; detail?: string };

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
		if (outcome.correctCount >= 3) return DAILY_TIER.medium.allCorrect;
		if (outcome.correctCount === 2) return DAILY_TIER.medium.twoCorrect;
		if (outcome.correctCount === 1) return DAILY_TIER.medium.oneCorrect;
		return DAILY_TIER.medium.noneCorrect;
	}
	return outcome.success ? DAILY_TIER.hard.success : DAILY_TIER.hard.fail;
}

export function dailyOutcomeSummary(outcome: DailyOutcome): string {
	if (outcome.difficulty === 'easy') {
		return outcome.correct ? 'Easy daily' : 'Easy daily (wrong answer)';
	}
	if (outcome.difficulty === 'medium') {
		return `Medium daily (${outcome.correctCount}/${outcome.total} correct)`;
	}
	const game = outcome.game === 'wordle' ? 'Wordle' : 'Speed click';
	if (outcome.success) {
		return outcome.detail ? `Hard daily: ${game} — ${outcome.detail}` : `Hard daily: ${game}`;
	}
	return outcome.detail ? `Hard daily: ${game} failed — ${outcome.detail}` : `Hard daily: ${game} failed`;
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
	if (outcome.difficulty === 'medium') {
		return `${outcome.correctCount}/${outcome.total} correct. Here's your reward...`;
	}
	if (outcome.success) {
		return outcome.detail ? `${outcome.detail} Here's your reward...` : "Here's your reward...";
	}
	return outcome.detail ? `${outcome.detail} Here's a smaller reward...` : "Here's a smaller reward...";
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
