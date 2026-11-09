import { describe, expect, test } from 'vitest';

import { formatChangelogSubject } from '../../src/lib/bsc/startupChangelog.js';

describe('formatChangelogSubject', () => {
	test('keeps PR numbers in subjects', () => {
		expect(formatChangelogSubject('Feature batch (#24)')).toBe('Feature batch (#24)');
		expect(formatChangelogSubject('Merge pull request #24 from DJay1/feature')).toBe('Merge #24');
	});
});
