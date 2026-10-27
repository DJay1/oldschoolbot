import { mysteryBoxOpenables } from '@/lib/bso/openables/mysteryBoxes.js';

import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MathRNG } from 'node-rng';
import { Bank, Items } from 'oldschooljs';
import { afterEach, expect, test, vi } from 'vitest';

import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { CanvasModule } from '@/lib/canvas/CanvasModule.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { getOpenableLoot } from '@/lib/openables.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test('Tradeable Mystery box quantity 255 is one batched roll and stays fast', async () => {
	const openable = mysteryBoxOpenables.find(o => o.id === 6199);
	expect(openable).toBeTruthy();
	const output = vi.spyOn(openable!, 'output');
	const started = performance.now();
	const result = await getOpenableLoot({
		openable: openable!,
		quantity: 255,
		user: new Bank() as unknown as MUser,
		totalLeaguesPoints: 0,
		rng: MathRNG
	});
	expect(performance.now() - started).toBeLessThan(2_000);
	expect(output).toHaveBeenCalledTimes(1);
	expect(output.mock.calls[0]?.[0].quantity).toBe(255);
	const totalQty = Object.values(result.bank.toJSON()).reduce((sum, qty) => sum + qty, 0);
	expect(totalQty).toBe(255);
});

async function spriteMissingItemIds(count: number): Promise<number[]> {
	await CanvasModule.waitTillReady();
	const bsoIcons = new Set(
		(await readdir(OSRSCanvas.ITEM_BSO_ICON_DIR)).map(file => Number.parseInt(path.parse(file).name, 10))
	);
	const ids: number[] = [];
	const seen = new Set<number>();
	for (const id of Items.itemNameMap.values()) {
		if (seen.has(id) || CanvasModule.allItemIdsWithSprite.has(id) || bsoIcons.has(id)) continue;
		seen.add(id);
		ids.push(id);
		if (ids.length === count) break;
	}
	if (ids.length < count) throw new Error(`Needed ${count} spritesheet-missing items, found ${ids.length}`);
	return ids;
}

test('bank image of many missing sprites finishes when icon fetch never resolves', async () => {
	const ids = await spriteMissingItemIds(16);
	for (const id of ids) {
		OSRSCanvas.LOCAL_ICON_CACHE.delete(id);
		await unlink(path.join(OSRSCanvas.ITEM_ICON_CACHE_DIR, `${id}.png`)).catch(() => null);
	}

	const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
	vi.stubGlobal('fetch', fetchMock);

	const bank = new Bank();
	for (const id of ids) bank.add(id);

	const started = performance.now();
	const { image } = await bankImageTask.generateBankImage({ bank });
	const elapsed = performance.now() - started;

	expect(elapsed).toBeLessThan(4_000);
	expect(image.byteLength).toBeGreaterThan(100);
	expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
	expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(ids.length);
}, 12_000);
