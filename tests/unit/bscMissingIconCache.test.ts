import '../../src/lib/util/clientSettings.js';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { bankImageTask } from '../../src/lib/canvas/bankImage.js';
import { OSRSCanvas } from '../../src/lib/canvas/OSRSCanvas.js';

const NO_ICON_A = 987_654_321;
const NO_ICON_B = 987_654_322;

describe('missing icon lookups are negative-cached', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		OSRSCanvas.MISSING_ICONS.clear();
	});

	test('a 404 is fetched once, later renders skip the network', async () => {
		await bankImageTask.ready;
		const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
		vi.stubGlobal('fetch', fetchMock);
		for (let i = 0; i < 5; i++) {
			await OSRSCanvas.getItemImage({ itemID: NO_ICON_A, networkTimeoutMs: 500 });
		}
		await OSRSCanvas.prefetchItemImages([NO_ICON_A]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(OSRSCanvas.isKnownMissingIcon(NO_ICON_A)).toBe(true);
		const until = OSRSCanvas.MISSING_ICONS.get(NO_ICON_A)!;
		expect(until - Date.now()).toBeGreaterThan(OSRSCanvas.MISSING_ICON_FAILED_MS);
	});

	test('a timeout is cached for a shorter time and the render is not held up again', async () => {
		await bankImageTask.ready;
		const fetchMock = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_, reject) =>
					init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
				)
		);
		vi.stubGlobal('fetch', fetchMock);
		await OSRSCanvas.getItemImage({ itemID: NO_ICON_B, networkTimeoutMs: 50 });
		const start = performance.now();
		await OSRSCanvas.getItemImage({ itemID: NO_ICON_B, networkTimeoutMs: 1500 });
		expect(performance.now() - start).toBeLessThan(40);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const until = OSRSCanvas.MISSING_ICONS.get(NO_ICON_B)!;
		expect(until - Date.now()).toBeLessThanOrEqual(OSRSCanvas.MISSING_ICON_FAILED_MS);
	});

	test('entries expire and the cache is bounded', () => {
		const now = Date.now();
		OSRSCanvas.markMissingIcon(1, 1000, now);
		expect(OSRSCanvas.isKnownMissingIcon(1, now + 999)).toBe(true);
		expect(OSRSCanvas.isKnownMissingIcon(1, now + 1001)).toBe(false);
		for (let i = 0; i < OSRSCanvas.MISSING_ICON_MAX + 50; i++) OSRSCanvas.markMissingIcon(10_000 + i, 1000, now);
		expect(OSRSCanvas.MISSING_ICONS.size).toBe(OSRSCanvas.MISSING_ICON_MAX);
	});
});
