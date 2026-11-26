import { expect, test } from 'vitest';

import { corgoDeniedReply, gifs, randomCorgoGif } from '../../../src/lib/bsc/corgoGifs.js';

test('refusal gifs are the Corgo set', () => {
	expect(gifs.length).toBeGreaterThanOrEqual(5);
	expect(gifs.length).toBeLessThanOrEqual(8);
	expect(new Set(gifs).size).toBe(gifs.length);
	for (const url of gifs) expect(url).toMatch(/^https:\/\/media\.giphy\.com\/media\/[A-Za-z0-9]+\/giphy\.gif$/);
	for (const old of ['NMZT5hsCgmHDVfGasZ', 'Y4pAQv58ETJgRwoLxj', '3oEduQAsYcJKQH2XsI']) {
		expect(gifs.some(url => url.includes(old))).toBe(false);
	}
});

test('ticket refusal shows a random Corgo gif as an embed image, never a bare link', () => {
	const picked = new Set(Array.from({ length: gifs.length }, (_, i) => randomCorgoGif(() => i / gifs.length)));
	expect(picked.size).toBe(gifs.length);
	expect(randomCorgoGif(() => 0.999999)).toBe(gifs[gifs.length - 1]);
	const reply = corgoDeniedReply(() => 0);
	expect(gifs).toContain(reply.embeds[0].image.url);
	expect(reply.content).not.toMatch(/https?:/);
	expect(reply.content.length).toBeLessThan(2000 - 150);
});
