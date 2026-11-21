import { readFileSync, statSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { RWT_GIF_PATH, RWT_MAX_GIF_BYTES, RWT_PREFIX_RE, rwtReply } from '@/lib/bsc/rwtReply.js';

describe('.rwt Corgo cash gif', () => {
	test('matches .rwt and !rwt only', () => {
		expect(RWT_PREFIX_RE.test('.rwt')).toBe(true);
		expect(RWT_PREFIX_RE.test('!rwt')).toBe(true);
		expect(RWT_PREFIX_RE.test('.RWT')).toBe(true);
		expect(RWT_PREFIX_RE.test('!Rwt')).toBe(true);
		expect(RWT_PREFIX_RE.test('.rwt please')).toBe(false);
		expect(RWT_PREFIX_RE.test('rwt')).toBe(false);
		expect(RWT_PREFIX_RE.test('.patreon')).toBe(false);
	});

	test('ships the stealing gif under 2MB', () => {
		const buf = readFileSync(RWT_GIF_PATH);
		expect(buf.subarray(0, 3).toString('ascii')).toBe('GIF');
		expect(buf.length).toBeGreaterThan(1000);
		expect(buf.length).toBeLessThan(RWT_MAX_GIF_BYTES);
		expect(statSync(RWT_GIF_PATH).size).toBe(buf.length);
	});

	test('reply is the gif only, with no text and no mentions', async () => {
		const reply = await rwtReply();
		expect(reply).not.toHaveProperty('content');
		expect(JSON.stringify(reply).toLowerCase()).not.toContain('corgi');
		expect(JSON.stringify(reply)).not.toMatch(/<@!?(\d+|everyone|here)>/);
		expect(reply.allowedMentions).toEqual({ parse: [], users: [], roles: [] });
		expect(reply.files).toHaveLength(1);
		expect(reply.files[0]?.name).toBe('rwt.gif');
		expect(reply.files[0]?.buffer.subarray(0, 3).toString('ascii')).toBe('GIF');
		expect(reply.files[0]?.buffer.length).toBeLessThan(RWT_MAX_GIF_BYTES);
	});
});
