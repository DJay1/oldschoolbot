import { expect, test } from 'vitest';

import { buttonEmoji, customEmoji, reactionEmoji, resolveEmojiText } from '../src/applicationEmoji.js';
import { Emoji } from '../src/constants.js';

test('known emojis render as an application emoji or a unicode fallback, never raw :name: text', () => {
	const attack = customEmoji('attack');
	expect(attack === '⚔️' || /^<:attack:\d{17,20}>$/.test(attack)).toBe(true);
	expect(attack).not.toMatch(/^:[A-Za-z0-9_]+:$/);

	expect(Emoji.Attack).toBe(attack);
	expect(Emoji.Cooking).toBe(customEmoji('cooking'));
	expect(Emoji.Construction).toBe(customEmoji('construction'));
	expect(Emoji.Joy).toBe('😂');
	expect(Emoji.Minigames).toBe(customEmoji('minigameIcon'));
});

test('case-distinct emojis stay distinct', () => {
	expect(customEmoji('Smokey')).not.toBe(customEmoji('smokey'));
	expect(customEmoji('Tangleroot')).toBe(customEmoji('tangleroot'));
});

test('unknown names and stored patron emojis', () => {
	expect(customEmoji('not_a_registered_emoji_zz')).toBe('▫️');
	expect(resolveEmojiText('before <:attack:630911039969427467> after')).toBe(`before ${customEmoji('attack')} after`);
	const foreign = '<:patron_only_icon:630911039969427467>';
	expect(resolveEmojiText(foreign)).toBe(foreign);
});

test('buttons and reactions fall back without sending an invalid custom emoji id', () => {
	const button = buttonEmoji('attack');
	if ('id' in button) {
		expect(button.id).toMatch(/^\d{17,20}$/);
	} else {
		expect(button.name).toBe('⚔️');
	}
	const reaction = reactionEmoji('RSHappy');
	expect(reaction === '😃' || /^RSHappy:\d{17,20}$/.test(reaction)).toBe(true);
});
