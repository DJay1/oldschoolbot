import { describe, expect, test } from 'vitest';

import { buildTradeCompletionContent, TRADE_BANK_DISPLAY_MAX } from '@/lib/util/tradeCompletion.js';

const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_BUFFER = 150;
const LONGEST_MENTION = `<@${'9'.repeat(20)}>`;

describe('trade completion message', () => {
	test('does not include the Grand Exchange tip', () => {
		const content = buildTradeCompletionContent('<@111>', '1x Skipper', '<@222>', 'No items');
		expect(content).toBe('<@111> sold 1x Skipper to <@222> in return for No items.');
		expect(content).not.toMatch(/Grand Exchange/i);
		expect(content).not.toMatch(/\/ge\b/);
		expect(content).not.toMatch(/You can now buy\/sell/i);
	});

	test('worst-case length stays at least 150 under Discord limit', () => {
		const bank = 'x'.repeat(TRADE_BANK_DISPLAY_MAX);
		const content = buildTradeCompletionContent(LONGEST_MENTION, bank, LONGEST_MENTION, bank);
		expect(content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		expect(content.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT);
		expect(content.startsWith(`${LONGEST_MENTION} sold `)).toBe(true);
		expect(content).toContain(' in return for ');
		expect(content.endsWith('.')).toBe(true);
	});
});
