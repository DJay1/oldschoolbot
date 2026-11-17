import '../../src/lib/util/clientSettings.js';

import { describe, expect, test } from 'vitest';

import { tfaResultHeader } from '../../src/lib/bsc/tfa/tfaActivity.js';

const U = '<@111111111111111111>';

describe('TFA trip result header', () => {
	test('solo full wipe says the minion failed (no "a The")', () => {
		const h = tfaResultHeader({ mention: U, isSolo: true, quantity: 1, completed: 0 });
		expect(h).toBe(`${U}, your minion failed The Fractured Archive raid!`);
		expect(h).not.toContain('finished');
		expect(h).not.toContain('a The');
	});

	test('solo success keeps the KC line and the mention', () => {
		expect(tfaResultHeader({ mention: U, isSolo: true, quantity: 1, completed: 1, kc: 12 })).toBe(
			`${U}, your minion finished The Fractured Archive raid! Your KC is now 12.`
		);
	});

	test('multi-raid trips: all failed, all finished, and mixed', () => {
		expect(tfaResultHeader({ mention: U, isSolo: true, quantity: 3, completed: 0 })).toBe(
			`${U}, your minion failed all 3 raids in The Fractured Archive!`
		);
		expect(tfaResultHeader({ mention: U, isSolo: true, quantity: 3, completed: 3, kc: 9 })).toBe(
			`${U}, your minion finished all 3 raids in The Fractured Archive! Your KC is now 9.`
		);
		expect(tfaResultHeader({ mention: U, isSolo: true, quantity: 3, completed: 2, kc: 8 })).toBe(
			`${U}, your minion finished 2/3 raids in The Fractured Archive (1 failed). Your KC is now 8.`
		);
	});

	test('teams and masses tag the leader and say the team failed', () => {
		expect(tfaResultHeader({ mention: U, isSolo: false, quantity: 1, completed: 0 })).toBe(
			`${U} Your team failed The Fractured Archive raid!`
		);
		expect(tfaResultHeader({ mention: U, isSolo: false, quantity: 4, completed: 1 })).toBe(
			`${U} Your team finished 1/4 raids in The Fractured Archive (3 failed).`
		);
		expect(tfaResultHeader({ mention: U, isSolo: false, quantity: 2, completed: 2 })).toBe(
			`${U} Your team finished all 2 raids in The Fractured Archive!`
		);
	});
});
