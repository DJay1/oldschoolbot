import '../../src/lib/util/clientSettings.js';

import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { AUTO_ROLES_INTERVAL, autoRolesDecision } from '../../src/lib/bsc/autoRolesSchedule.js';

describe('BSC auto roles schedule', () => {
	const now = Date.UTC(2026, 10, 16, 12);

	test('refreshes once a week', () => {
		expect(AUTO_ROLES_INTERVAL).toBe(Time.Day * 7);
	});

	test('no stored run seeds instead of running', () => {
		expect(autoRolesDecision(null, now)).toBe('seed');
	});

	test('restarts within the week do not run it', () => {
		expect(autoRolesDecision(now - Time.Minute * 10, now)).toBe('skip');
		expect(autoRolesDecision(now - Time.Hour * 6, now)).toBe('skip');
		expect(autoRolesDecision(now - AUTO_ROLES_INTERVAL + Time.Minute, now)).toBe('skip');
	});

	test('runs once a full interval has passed', () => {
		expect(autoRolesDecision(now - AUTO_ROLES_INTERVAL, now)).toBe('run');
		expect(autoRolesDecision(now - Time.Day * 30, now)).toBe('run');
	});

	test('a 14 day interval waits two weeks', () => {
		expect(autoRolesDecision(now - Time.Day * 10, now, Time.Day * 14)).toBe('skip');
		expect(autoRolesDecision(now - Time.Day * 14, now, Time.Day * 14)).toBe('run');
	});
});