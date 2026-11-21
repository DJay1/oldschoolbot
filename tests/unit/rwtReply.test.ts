import { readFileSync, statSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import {
	RWT_GIF_PATHS,
	RWT_MAX_GIF_BYTES,
	RWT_MESSAGE,
	RWT_PREFIX_RE,
	pickRwtGif,
	rwtReply
} from '@/lib/bsc/rwtReply.js';

describe('.rwt Corgo cash warning', () => {
	test('player-facing text stays well under Discord message limits', () => {
		expect(RWT_MESSAGE.length).toBeGreaterThan(20);
		expect(RWT_MESSAGE.length).toBeLessThanOrEqual(2000 - 150);
		expect(RWT_MESSAGE.toLowerCase()).not.toContain('corgi');
		expect(RWT_MESSAGE).not.toMatch(/<@!?(\d+|everyone|here)>/);
	});

	test('matches .rwt and !rwt only', () => {
		expect(RWT_PREFIX_RE.test('.rwt')).toBe(true);
		expect(RWT_PREFIX_RE.test('!rwt')).toBe(true);
		expect(RWT_PREFIX_RE.test('.RWT')).toBe(true);
		expect(RWT_PREFIX_RE.test('!Rwt')).toBe(true);
		expect(RWT_PREFIX_RE.test('.rwt please')).toBe(false);
		expect(RWT_PREFIX_RE.test('rwt')).toBe(false);
		expect(RWT_PREFIX_RE.test('.patreon')).toBe(false);
	});

	test('picks each local Corgo cash gif', () => {
		expect(pickRwtGif(() => 0)).toBe(RWT_GIF_PATHS[0]);
		expect(pickRwtGif(() => 0.99)).toBe(RWT_GIF_PATHS[1]);
	});

	test('ships both gifs under 2MB', () => {
		expect(RWT_GIF_PATHS).toHaveLength(2);
		for (const path of RWT_GIF_PATHS) {
			const buf = readFileSync(path);
			expect(buf.subarray(0, 3).toString('ascii')).toBe('GIF');
			expect(buf.length).toBeGreaterThan(1000);
			expect(buf.length).toBeLessThan(RWT_MAX_GIF_BYTES);
			expect(statSync(path).size).toBe(buf.length);
		}
	});

	test('reply keeps the warning text and attaches a gif without mentions', async () => {
		const reply = await rwtReply(() => 0);
		expect(reply.content).toBe(RWT_MESSAGE);
		expect(reply.allowedMentions).toEqual({ parse: [], users: [], roles: [] });
		expect(reply.files).toHaveLength(1);
		expect(reply.files[0]?.name).toBe('rwt.gif');
		expect(reply.files[0]?.buffer.subarray(0, 3).toString('ascii')).toBe('GIF');
	});
});
