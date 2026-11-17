import '../../src/lib/util/clientSettings.js';

import { describe, expect, test } from 'vitest';

import { tobResultHeader } from '../../src/tasks/minions/minigames/tobActivity.js';

const U = '<@111111111111111111>';

describe('ToB trip result header', () => {
	test('full team wipe says the team failed, not "has finished"', () => {
		const h = tobResultHeader({ allTag: U, hardMode: false, isSolo: false, quantity: 1, wipes: 1 });
		expect(h).toBe(`**${U} Your team failed the Theatre of Blood raid!**`);
		expect(h).not.toContain('finished');
	});

	test('solo and hard mode wipes', () => {
		expect(tobResultHeader({ allTag: U, hardMode: true, isSolo: true, quantity: 1, wipes: 1 })).toBe(
			`**${U} Your minion failed the Hard Mode Theatre of Blood raid!**`
		);
		expect(tobResultHeader({ allTag: U, hardMode: false, isSolo: false, quantity: 3, wipes: 3 })).toBe(
			`**${U} Your team failed all 3 raids in the Theatre of Blood!**`
		);
	});

	test('mixed trips count failures, clean trips are unchanged', () => {
		expect(tobResultHeader({ allTag: U, hardMode: false, isSolo: false, quantity: 3, wipes: 1 })).toBe(
			`**${U} Your Theatre of Blood has finished (1/3 raids failed)**`
		);
		expect(tobResultHeader({ allTag: U, hardMode: true, isSolo: false, quantity: 1, wipes: 0 })).toBe(
			`**${U} Your Hard Mode Theatre of Blood has finished**`
		);
	});

	test('the header always leaves room in a 2,000 character message (5 mentions)', () => {
		const tags = '<@111111111111111111>'.repeat(5);
		const h = tobResultHeader({ allTag: tags, hardMode: true, isSolo: false, quantity: 99, wipes: 98 });
		expect(h.length).toBeLessThan(250);
	});
});
