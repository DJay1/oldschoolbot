import { describe, expect, test } from 'vitest';

import { extractBulletLines, formatChangelogSubject } from '../../src/lib/bsc/startupChangelog.js';

describe('formatChangelogSubject', () => {
	test('keeps PR numbers in subjects', () => {
		expect(formatChangelogSubject('Feature batch (#24)')).toBe('Feature batch (#24)');
		expect(formatChangelogSubject('Merge pull request #24 from DJay1/feature')).toBe('Merge #24');
	});
});

describe('extractBulletLines', () => {
	test('pulls markdown bullets from a body', () => {
		const body = `Title\n\n- Alpha change\n* Beta change\n• Gamma change\nNot a bullet\n`;
		expect(extractBulletLines(body)).toEqual(['Alpha change', 'Beta change', 'Gamma change']);
	});
});
