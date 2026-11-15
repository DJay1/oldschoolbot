import { describe, expect, test } from 'vitest';

import {
	adminActionTier,
	describeStaffAction,
	resolveStaffTier,
	rpActionTier,
	STAFF_ACTIONS,
	STAFF_BOOST_MINUTES,
	staffActionsFor,
	staffBoostWeeklyCap,
	staffWeekKey,
	tierAtLeast
} from '../../../src/lib/bsc/staffTiers.js';

const base = { isAdmin: false, isDeveloper: false, isMod: false, isProduction: true };
const u = { user: { user: { id: '123', username: 'Bob' } } };

describe('staff tiers', () => {
	test('real tiers', () => {
		expect(resolveStaffTier(base)).toBe('none');
		expect(resolveStaffTier({ ...base, isMod: true })).toBe('moderator');
		expect(resolveStaffTier({ ...base, isMod: true, isDeveloper: true })).toBe('developer');
		expect(resolveStaffTier({ ...base, isAdmin: true })).toBe('admin');
	});

	test('test override never works on prod and never grants admin', () => {
		expect(resolveStaffTier({ ...base, override: 'developer' })).toBe('none');
		expect(resolveStaffTier({ ...base, isProduction: false, override: 'moderator' })).toBe('moderator');
		expect(resolveStaffTier({ ...base, isProduction: false, override: 'admin' })).toBe('developer');
		expect(resolveStaffTier({ ...base, isAdmin: true, isProduction: false, override: 'moderator' })).toBe(
			'moderator'
		);
		expect(resolveStaffTier({ ...base, isAdmin: true, isProduction: false, override: 'admin' })).toBe('admin');
	});

	test('boost caps and length', () => {
		expect(STAFF_BOOST_MINUTES).toBe(30);
		expect(staffBoostWeeklyCap('none')).toBe(0);
		expect(staffBoostWeeklyCap('moderator')).toBe(2);
		expect(staffBoostWeeklyCap('developer')).toBe(2);
		expect(staffBoostWeeklyCap('admin')).toBe(4);
	});

	test('week key is the Monday in Chicago time', () => {
		// Sun Nov 15 2026 11:30 PM CT = Mon 05:30 UTC: still the week of Mon Nov 9.
		expect(staffWeekKey(Date.UTC(2026, 10, 16, 5, 30))).toBe('2026-11-09');
		// Mon Nov 16 2026 12:30 AM CT = 06:30 UTC: new week.
		expect(staffWeekKey(Date.UTC(2026, 10, 16, 6, 30))).toBe('2026-11-16');
		expect(staffWeekKey(Date.UTC(2026, 10, 22, 18, 0))).toBe('2026-11-16');
	});

	test('admin command tiers', () => {
		expect(adminActionTier({ cancel_task: u })).toBe('moderator');
		for (const k of ['testerpoints', 'item_stats', 'fix_giveaways', 'announce']) {
			expect(adminActionTier({ [k]: {} })).toBe('developer');
		}
		expect(adminActionTier({ leagues: { validate_tasks: {} } })).toBe('developer');
		expect(adminActionTier({ leagues: { verify_tasks: u } })).toBe('developer');
		expect(adminActionTier({ leagues: { cleanup_duplicates: {} } })).toBe('admin');
		expect(adminActionTier({ event: { action: 'list' } })).toBe('developer');
		for (const action of ['enable', 'disable', 'schedule', 'reset']) {
			expect(adminActionTier({ event: { action } })).toBe('admin');
		}
		for (const k of [
			'clear_busy',
			'badges',
			'bypass_age',
			'command',
			'set_price',
			'bitfield',
			'view',
			'sync_commands',
			'give',
			'give_items',
			'giveaway',
			'bury_in_sand',
			'patron',
			'cap_balances',
			'announce_backfill',
			'run',
			'shut_down',
			'ltc'
		]) {
			expect(adminActionTier({ [k]: {} })).toBe('admin');
		}
		expect(adminActionTier({})).toBe('admin');
		expect(adminActionTier(null)).toBe('admin');
	});

	test('rp command tiers', () => {
		for (const k of ['viewbank', 'viewgear', 'view_user', 'list_trades', 'ge_cancel']) {
			expect(rpActionTier({ player: { [k]: u } })).toBe('moderator');
		}
		for (const k of ['set_buy_date', 'add_patron_time', 'unequip_all_items', 'steal_items', 'migrate_user']) {
			expect(rpActionTier({ player: { [k]: u } })).toBe('admin');
		}
		expect(rpActionTier({ player: { viewbank: u, steal_items: u } })).toBe('admin');
		expect(rpActionTier({ user_event: { max: {} } })).toBe('admin');
		expect(rpActionTier({})).toBe('admin');
	});

	test('logged actions', () => {
		expect(describeStaffAction('admin', { cancel_task: u })).toBe('cancel_task on Bob[123]');
		expect(describeStaffAction('rp', { player: { ge_cancel: u } })).toBe('ge_cancel on Bob[123]');
		expect(describeStaffAction('admin', { event: { action: 'list' } })).toBe('event list');
		expect(describeStaffAction('admin', { announce: { message: 'hi' } })).toBe('announce: hi');
		expect(describeStaffAction('rp', { player: { viewbank: u } })).toBeNull();
	});

	test('help lists only what each tier can use', () => {
		expect(staffActionsFor('none')).toEqual([]);
		const mod = staffActionsFor('moderator').map(a => a.command);
		expect(mod).toContain('/staff ge_cancel');
		expect(mod).not.toContain('/staff announce');
		const dev = staffActionsFor('developer').map(a => a.command);
		expect(dev).toContain('/staff announce');
		expect(dev).not.toContain('/admin and /rp');
		expect(staffActionsFor('admin')).toHaveLength(STAFF_ACTIONS.length);
		expect(tierAtLeast('developer', 'moderator')).toBe(true);
		expect(tierAtLeast('moderator', 'developer')).toBe(false);
	});
});
