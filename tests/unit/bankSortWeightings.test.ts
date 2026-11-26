import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { BANK_WEIGHTINGS_ADD_HINT, formatBankSortWeightingsList } from '@/lib/sorts.js';

describe('bank sort weightings list', () => {
	test('shows a hint when there are no weightings', () => {
		const text = formatBankSortWeightingsList(new Bank());

		expect(text).toContain('You have no bank sort weightings');

		expect(text).toContain(BANK_WEIGHTINGS_ADD_HINT);

		expect(text.length).toBeLessThanOrEqual(2000 - 150);
	});

	test('lists all weightings in a clean text list, highest first', () => {
		const text = formatBankSortWeightingsList(new Bank().add('Coal', 5).add('Trout', 1).add('Shark', 20));

		expect(text).toContain('**Bank sort weightings** (3 items):');

		expect(text).toContain('Shark: 20');

		expect(text).toContain('Coal: 5');

		expect(text).toContain('Trout: 1');

		expect(text.indexOf('Shark: 20')).toBeLessThan(text.indexOf('Coal: 5'));

		expect(text.length).toBeLessThanOrEqual(2000 - 150);
	});
});
