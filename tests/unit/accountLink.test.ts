import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import {
	BSC_ACCOUNT_LINK_CONFIRM_MS,
	BSC_ACCOUNT_RELINK_COOLDOWN_PROD_MS,
	BSC_ACCOUNT_RELINK_COOLDOWN_TEST_MS,
	bscAccountRelinkCooldownMs,
	evaluateLinkStart,
	linkRequestMessage,
	linkStartFailureMessage,
	linkSuccessMessage,
	linkedStatusMessage,
	notLinkedStatusMessage,
	relinkCooldownRemaining,
	unlinkConfirmMessage,
	unlinkSuccessMessage
} from '@/lib/bsc/accountLink.js';

const DISCORD_CONTENT_LIMIT = 2000;
const HEADROOM = 150;
const LONG_MENTION = `<@${'9'.repeat(20)}>`;
const LONG_TIER = 'Biggest of Dogs';

describe('account link rules', () => {
	const base = {
		actorId: '1',
		targetId: '2',
		actorIsIron: false,
		targetIsIron: true,
		actorLink: null,
		targetLink: null,
		actorCooldownRemainingMs: 0,
		targetCooldownRemainingMs: 0
	};

	test('allows a regular account to start a link to one iron', () => {
		expect(evaluateLinkStart(base)).toEqual({ ok: true });
	});

	test('rejects self, iron starter, non-iron target, existing links, and relink cooldown', () => {
		expect(evaluateLinkStart({ ...base, targetId: '1' }).ok).toBe(false);
		expect(evaluateLinkStart({ ...base, targetId: '1' })).toMatchObject({ reason: 'self' });
		expect(evaluateLinkStart({ ...base, actorIsIron: true })).toMatchObject({ reason: 'actor_is_iron' });
		expect(evaluateLinkStart({ ...base, targetIsIron: false })).toMatchObject({ reason: 'target_not_iron' });
		expect(
			evaluateLinkStart({
				...base,
				actorLink: { mainId: '1', ironId: '3', linkedAt: new Date() }
			})
		).toMatchObject({ reason: 'actor_linked' });
		expect(
			evaluateLinkStart({
				...base,
				targetLink: { mainId: '4', ironId: '2', linkedAt: new Date() }
			})
		).toMatchObject({ reason: 'target_linked' });
		expect(evaluateLinkStart({ ...base, actorCooldownRemainingMs: 1000 })).toMatchObject({
			reason: 'actor_cooldown',
			remainingMs: 1000
		});
		expect(evaluateLinkStart({ ...base, targetCooldownRemainingMs: 2000 })).toMatchObject({
			reason: 'target_cooldown',
			remainingMs: 2000
		});
	});

	test('relink cooldown is 7 days in prod and 5 minutes on the test bot', () => {
		expect(BSC_ACCOUNT_RELINK_COOLDOWN_PROD_MS).toBe(Time.Day * 7);
		expect(BSC_ACCOUNT_RELINK_COOLDOWN_TEST_MS).toBe(Time.Minute * 5);
		expect(bscAccountRelinkCooldownMs('prod')).toBe(Time.Day * 7);
		expect(bscAccountRelinkCooldownMs('test')).toBe(Time.Minute * 5);
		expect(bscAccountRelinkCooldownMs(undefined)).toBe(Time.Day * 7);
		expect(relinkCooldownRemaining(null, Date.now(), Time.Day * 7)).toBe(0);
		expect(relinkCooldownRemaining(1_000, 1_000 + Time.Day * 7, Time.Day * 7)).toBe(0);
		expect(relinkCooldownRemaining(1_000, 1_000 + Time.Day * 6, Time.Day * 7)).toBe(Time.Day);
	});
});

describe('account link command copy stays under Discord limits', () => {
	const messages = [
		linkStartFailureMessage('self'),
		linkStartFailureMessage('actor_is_iron'),
		linkStartFailureMessage('target_not_iron'),
		linkStartFailureMessage('actor_linked'),
		linkStartFailureMessage('target_linked', 0, LONG_MENTION),
		linkStartFailureMessage('actor_cooldown', Time.Day * 7 + Time.Hour * 23),
		linkStartFailureMessage('target_cooldown', Time.Day * 7 + Time.Hour * 23, LONG_MENTION),
		linkRequestMessage(LONG_MENTION, LONG_MENTION),
		linkSuccessMessage(LONG_MENTION, LONG_MENTION),
		unlinkConfirmMessage(LONG_MENTION),
		unlinkSuccessMessage(Time.Day * 7 + Time.Hour * 23),
		notLinkedStatusMessage(),
		linkedStatusMessage({ viewerIsIron: false, otherMention: LONG_MENTION, tierName: LONG_TIER }),
		linkedStatusMessage({ viewerIsIron: true, otherMention: LONG_MENTION, tierName: LONG_TIER }),
		linkedStatusMessage({ viewerIsIron: true, otherMention: LONG_MENTION, tierName: null })
	];

	test('worst-case player-facing lines stay at least 150 under the 2000 limit', () => {
		expect(BSC_ACCOUNT_LINK_CONFIRM_MS).toBe(Time.Second * 90);
		for (const message of messages) {
			expect(message.length).toBeLessThan(DISCORD_CONTENT_LIMIT - HEADROOM);
		}
	});
});
