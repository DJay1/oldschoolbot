import { keyCrateBuyables } from '@/lib/bso/buyables/keyCrateBuyables.js';

import { describe, expect, test } from 'vitest';

describe('key crate buyables', () => {
	test('Supply crate key is not sold on /buy', () => {
		const names = keyCrateBuyables.map(item => item.name);

		expect(names).not.toContain('Supply crate key (s1)');

		expect(names.some(name => name.startsWith('Birthday crate key'))).toBe(true);
	});
});
