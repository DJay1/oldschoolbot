import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const toolsSrc = readFileSync('src/mahoji/commands/tools.ts', 'utf8');

describe('/tools patron minion_stats', () => {
	test('is open to everyone and does not check perk tier', () => {
		const start = toolsSrc.indexOf('if (patron.minion_stats)');
		const end = toolsSrc.indexOf('if (patron.give_box)');
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const block = toolsSrc.slice(start, end);
		expect(block).toContain('return minionStats(user)');
		expect(block).not.toContain('PerkTier');
		expect(block).not.toContain('patronMsg');
		expect(block.length).toBeLessThan(250);
	});
});
