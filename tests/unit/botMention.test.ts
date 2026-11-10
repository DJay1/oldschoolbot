import { describe, expect, test } from 'vitest';

import { contentMentionsBot, mentionUsageHelp, parseBotMention } from '@/lib/util/botMention.js';

const clientId = '123456789012345678';
const commands = ['stats', 's', 'bank', 'cd', 'patreon'];

describe('bot mention parsing', () => {
	test('ignores messages that do not mention the bot', () => {
		expect(parseBotMention('hello', clientId, commands)).toEqual({ kind: 'none' });
		expect(contentMentionsBot('hello <@999>', clientId)).toBe(false);
	});

	test('treats a bare mention as status, including nickname mentions', () => {
		expect(parseBotMention(`<@${clientId}>`, clientId, commands)).toEqual({ kind: 'status' });
		expect(parseBotMention(`<@!${clientId}>`, clientId, commands)).toEqual({ kind: 'status' });
		expect(parseBotMention(`  <@${clientId}>  `, clientId, commands)).toEqual({ kind: 'status' });
	});

	test('parses mention commands and aliases', () => {
		expect(parseBotMention(`<@${clientId}> stats`, clientId, commands)).toEqual({
			kind: 'command',
			name: 'stats',
			args: ''
		});
		expect(parseBotMention(`<@!${clientId}> s hello there`, clientId, commands)).toEqual({
			kind: 'command',
			name: 's',
			args: 'hello there'
		});
	});

	test('unknown trailing text is not silent', () => {
		expect(parseBotMention(`<@${clientId}> please kill graardor`, clientId, commands)).toEqual({
			kind: 'unknown',
			text: 'please kill graardor'
		});
		expect(parseBotMention(`hey <@${clientId}>`, clientId, commands).kind).toBe('unknown');
		expect(mentionUsageHelp().toLowerCase()).toContain('tag me by itself');
	});
});
