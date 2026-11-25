import { EItem } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { itemStatsMessage, itemStatsOwnedSql, ownedQtyFromSum } from '@/lib/bsc/itemStats.js';
const DISCORD_CONTENT_LIMIT = 2000;
const DISCORD_LENGTH_MARGIN = 150;

describe('/staff item_stats owned quantity', () => {
	test('null or missing sum (Coins, or an item nobody owns) is 0, not a crash', () => {
		expect(ownedQtyFromSum(null)).toBe(0n);
		expect(ownedQtyFromSum(undefined)).toBe(0n);
	});

	test('bigint, number, and numeric string results are kept', () => {
		expect(ownedQtyFromSum(12n)).toBe(12n);
		expect(ownedQtyFromSum(12)).toBe(12n);
		expect(ownedQtyFromSum('32080117808')).toBe(32080117808n);
	});
});

describe('/staff item_stats SQL', () => {
	test('Coins includes the GP column and uses bigint, not int', () => {
		const sql = itemStatsOwnedSql(EItem.COINS);
		expect(EItem.COINS).toBe(995);
		expect(sql).toMatch(/SUM\("GP"\)/);
		expect(sql).toContain("bank->>'995'");
		expect(sql).toMatch(/::bigint/);
		expect(sql).not.toMatch(/::int\b/);
	});

	test('a normal item sums bank stacks as bigint and coalesces to 0', () => {
		const sql = itemStatsOwnedSql(4151);
		expect(sql).toContain("bank->>'4151'");
		expect(sql).toContain("COALESCE(SUM((bank->>'4151')::bigint), 0)");
		expect(sql).not.toMatch(/::int\b/);
		expect(sql).not.toMatch(/SUM\("GP"\)/);
	});

	test('rejects bad ids so they cannot be interpolated into SQL', () => {
		expect(() => itemStatsOwnedSql(1.5)).toThrow(/Invalid itemID/);
		expect(() => itemStatsOwnedSql(Number.NaN)).toThrow(/Invalid itemID/);
		expect(() => itemStatsOwnedSql(-1)).toThrow(/Invalid itemID/);
	});
});

describe('/staff item_stats message', () => {
	test('Coins with a zero count and with a large total', () => {
		expect(itemStatsMessage('Coins', 0n, 0)).toBe(
			'There are 0 Coins owned by everyone.\nThere are 0 people with at least 1 Coins in their collection log.'
		);
		expect(itemStatsMessage('Coins', 32_080_117_808n, 12)).toContain(
			'There are 32,080,117,808 Coins owned by everyone.'
		);
	});

	test('a normal item', () => {
		const msg = itemStatsMessage('Abyssal whip', 1234n, 56);
		expect(msg).toContain('There are 1,234 Abyssal whip owned by everyone.');
		expect(msg).toContain('There are 56 people with at least 1 Abyssal whip in their collection log.');
	});

	test('worst-case length stays at least 150 under the Discord content limit', () => {
		const name = 'W'.repeat(200);
		const msg = itemStatsMessage(name, 10n ** 36n, Number.MAX_SAFE_INTEGER);
		expect(msg.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - DISCORD_LENGTH_MARGIN);
	});
});
