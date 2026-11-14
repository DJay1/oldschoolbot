import { describe, expect, test } from 'vitest';

import { isLoggableCommandName } from '@/lib/util/commandUsageName.js';

describe('command usage log names', () => {
	test('known commands are logged', () => {
		expect(isLoggableCommandName('testpotato')).toBe(true);
		expect(isLoggableCommandName('bank')).toBe(true);
	});

	test('commands missing from the database enum are skipped instead of erroring', () => {
		expect(isLoggableCommandName('thanksgiving')).toBe(false);
		expect(isLoggableCommandName('definitely_not_a_command')).toBe(false);
	});
});
