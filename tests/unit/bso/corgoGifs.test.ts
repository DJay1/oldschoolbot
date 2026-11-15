import { expect, test } from 'vitest';

import { gifs } from '../../../src/lib/bsc/corgoGifs.js';

test('refusal gifs are the Corgo set', () => {
	expect(gifs.length).toBeGreaterThanOrEqual(5);
	expect(gifs.length).toBeLessThanOrEqual(8);
	expect(new Set(gifs).size).toBe(gifs.length);
	for (const url of gifs) expect(url).toMatch(/^https:\/\/media\.giphy\.com\/media\/[A-Za-z0-9]+\/giphy\.gif$/);
	for (const old of ['NMZT5hsCgmHDVfGasZ', 'Y4pAQv58ETJgRwoLxj', '3oEduQAsYcJKQH2XsI']) {
		expect(gifs.some(url => url.includes(old))).toBe(false);
	}
});
