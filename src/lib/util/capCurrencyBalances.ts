/**
 * Manual cap for currency columns. Preview by default; nothing is written unless apply is set.
 * Values above the cap are lowered to the cap.
 */
const USER_CAPS = {
	lms_points: 5_000_000,
	volcanic_mine_points: 50_000_000,
	nmz_points: 100_000_000,
	carpenter_points: 5_000_000,
	zeal_tokens: 5_000_000,
	slayer_points: 5_000_000,
	ourania_tokens: 50_000_000,
	dungeoneering_tokens: 50_000_000
} as const;

const STATS_CAPS = {
	tithe_farm_points: 5_000_000,
	vale_research_points: 5_000_000,
	pest_control_points: 5_000_000,
	foundry_reputation: 5_000_000,
	honour_points: 5_000_000
} as const;

const MINIGAME_CAPS = {
	pizazz_points: 5_000_000
} as const;

export async function capCurrencyBalances(apply: boolean): Promise<string> {
	const lines: string[] = [
		apply
			? 'Applied currency caps. Balances above the maximum were set to that maximum.'
			: 'Preview only. No balances were changed.'
	];

	for (const [field, max] of Object.entries(USER_CAPS)) {
		const where = { [field]: { gt: max } };
		const count = await prisma.user.count({ where });
		if (apply && count > 0) {
			await prisma.user.updateMany({ where, data: { [field]: max } });
		}
		lines.push(`${field}: ${count.toLocaleString()} above ${max.toLocaleString()}`);
	}

	for (const [field, max] of Object.entries(STATS_CAPS)) {
		const where = { [field]: { gt: max } };
		const count = await prisma.userStats.count({ where });
		if (apply && count > 0) {
			await prisma.userStats.updateMany({ where, data: { [field]: max } });
		}
		lines.push(`${field}: ${count.toLocaleString()} above ${max.toLocaleString()}`);
	}

	for (const [field, max] of Object.entries(MINIGAME_CAPS)) {
		const where = { [field]: { gt: max } };
		const count = await prisma.minigame.count({ where });
		if (apply && count > 0) {
			await prisma.minigame.updateMany({ where, data: { [field]: max } });
		}
		lines.push(`${field}: ${count.toLocaleString()} above ${max.toLocaleString()}`);
	}

	return lines.join('\n');
}
