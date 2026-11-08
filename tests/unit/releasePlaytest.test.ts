import { afterEach, expect, test } from 'vitest';

import { Emoji } from '@oldschoolgg/toolkit';

import { parseAdminUserIds, testingShortcutsEnabled } from '@/lib/constants.js';
import { isProductionMode } from '@/lib/hosting/productionMode.js';
import { LAUNCH_FOUNDER_BADGE, LAUNCH_XP_BONUS_SENTENCE } from '@/lib/events/launch/constants.js';
import { isEventActive } from '@/lib/events/registry.js';
import { consolidateSkillXpBonusLines } from '@/lib/bso/firstAge/skillOutfits.js';
import { DEFAULT_PATREON_URL, patreonUrl, withPatreonLink } from '@/lib/patreonLink.js';
import { makeBadgeString } from '@/lib/util/makeBadgeString.js';
import {
	DAILY_CONSOLATION_GP,
	DAILY_CONSOLATION_ITEMS,
	DAILY_JACKPOT_GP,
	DAILY_RARE_ROLL
} from '@/mahoji/lib/abstracted_commands/dailyCommand.js';
import {
	MAX_OPEN_PER_COMMAND,
	openUntilOpenCount,
	openUntilResultMessage
} from '@/mahoji/lib/abstracted_commands/openCommand.js';

const previousProduction = process.env.PRODUCTION;
const previousPatreon = process.env.PATREON_URL;

afterEach(() => {
	if (previousProduction === undefined) delete process.env.PRODUCTION;
	else process.env.PRODUCTION = previousProduction;
	if (previousPatreon === undefined) delete process.env.PATREON_URL;
	else process.env.PATREON_URL = previousPatreon;
});

test('open until without a quantity uses the cap, and the cap is named in the reply', () => {
	expect(openUntilOpenCount(undefined, 50_000)).toBe(MAX_OPEN_PER_COMMAND);
	expect(openUntilOpenCount(undefined, 12)).toBe(12);
	expect(openUntilOpenCount(4, 100)).toBe(4);
	expect(
		openUntilResultMessage({
			amountOpened: MAX_OPEN_PER_COMMAND,
			openedName: 'Reward casket (grandmaster)',
			targetCount: 0,
			targetQuantity: 1,
			targetName: 'First age cape'
		})
	).toContain('hit the 10,000 open cap');
	expect(
		openUntilResultMessage({
			amountOpened: 3,
			openedName: 'Reward casket (beginner)',
			targetCount: 1,
			targetQuantity: 1,
			targetName: 'Fire rune'
		})
	).toContain('successfully obtained 1x Fire rune');
});

test('the daily rare roll is 1 in 1000 and the other side is a smaller prize', () => {
	expect(DAILY_RARE_ROLL).toBe(1_000);
	expect(DAILY_JACKPOT_GP).toBe(1_000_000_000);
	expect(DAILY_CONSOLATION_GP).toBe(100_000_000);
	expect(DAILY_CONSOLATION_ITEMS.amount('Tradeable Mystery Box')).toBe(1);
	expect(DAILY_CONSOLATION_ITEMS.amount('Untradeable Mystery Box')).toBe(1);
	expect(DAILY_CONSOLATION_ITEMS.amount('Equippable mystery box')).toBe(1);
});

test('Patreon defaults to the BSC page and can be overridden', () => {
	delete process.env.PATREON_URL;
	expect(DEFAULT_PATREON_URL).toBe('https://patreon.com/bscbot');
	expect(patreonUrl()).toBe('https://patreon.com/bscbot');
	expect(withPatreonLink('Perks.')).toBe('Perks. https://patreon.com/bscbot');
	process.env.PATREON_URL = 'https://patreon.com/example';
	expect(patreonUrl()).toBe('https://patreon.com/example');
});

test('production mode turns testing shortcuts off', () => {
	process.env.PRODUCTION = 'false';
	expect(isProductionMode()).toBe(false);
	expect(testingShortcutsEnabled()).toBe(true);
	process.env.PRODUCTION = 'true';
	expect(isProductionMode()).toBe(true);
	expect(testingShortcutsEnabled()).toBe(false);
});

test('admin ids come from ADMIN_USER_IDS', () => {
	expect(parseAdminUserIds(undefined)).toEqual(['290167629966999552']);
	expect(parseAdminUserIds('111111111111111111, 222222222222222222')).toEqual([
		'111111111111111111',
		'222222222222222222'
	]);
	expect(parseAdminUserIds('nope')).toEqual(['290167629966999552']);
});

test('the launch event is off until an admin enables it, and the founder mark still renders', () => {
	expect(isEventActive('launch')).toBe(false);
	expect(makeBadgeString([], false, false, true)).toBe(LAUNCH_FOUNDER_BADGE);
	expect(makeBadgeString([], true, true, true)).toBe(`${Emoji.EsbCorgi} ${Emoji.Ironman}`);
});

test('a trip keeps one launch XP sentence', () => {
	const line = `You received 1,000 XP. ${LAUNCH_XP_BONUS_SENTENCE}`;
	expect(consolidateSkillXpBonusLines(`${line}\n${line}`).match(/Launch event/g)).toHaveLength(1);
});
