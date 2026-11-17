import '../../src/lib/util/clientSettings.js';

import { itemID } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { bankImageTask } from '../../src/lib/canvas/bankImage.js';
import { BoundedImageCache, imageSourceId } from '../../src/lib/canvas/imageCaches.js';
import { OSRSCanvas } from '../../src/lib/canvas/OSRSCanvas.js';

describe('bank render image caches', () => {
	test('bounded cache drops the least recently used entry', () => {
		const cache = new BoundedImageCache<number>(2);
		cache.set('a', 1);
		cache.set('b', 2);
		expect(cache.get('a')).toBe(1); // a is now most recent
		cache.set('c', 3);
		expect(cache.size).toBe(2);
		expect(cache.get('b')).toBeUndefined();
		expect(cache.get('a')).toBe(1);
		expect(cache.get('c')).toBe(3);
		let made = 0;
		cache.getOrCreate('c', () => ++made);
		expect(made).toBe(0);
	});

	test('image source ids are stable per object', () => {
		const a = {};
		const b = {};
		expect(imageSourceId(a)).toBe(imageSourceId(a));
		expect(imageSourceId(a)).not.toBe(imageSourceId(b));
	});

	test('spritesheet icons are cut once and reused', async () => {
		await bankImageTask.ready;
		const id = itemID('Coins');
		const first = await OSRSCanvas.getItemImage({ itemID: id });
		const second = await OSRSCanvas.getItemImage({ itemID: id });
		expect(second).toBe(first);
	});

	test('dyed sprites are recoloured once per item and colour', async () => {
		await bankImageTask.ready;
		OSRSCanvas.TINTED_ICON_CACHE.clear();
		const canvas = new OSRSCanvas({ width: 200, height: 100 });
		const dye = (hex: string) =>
			({ itemID: itemID('Abyssal whip'), dyeKey: 'golden', mode: 'recolour', recolourHex: hex }) as any;
		for (let i = 0; i < 5; i++) {
			await canvas.drawItemIDSprite({
				itemID: itemID('Abyssal whip'),
				x: 0,
				y: 0,
				patronDyeOverride: dye('#D4A017')
			});
		}
		expect(OSRSCanvas.TINTED_ICON_CACHE.size).toBe(1);
		await canvas.drawItemIDSprite({
			itemID: itemID('Abyssal whip'),
			x: 0,
			y: 0,
			patronDyeOverride: dye('#4A3DFF')
		});
		expect(OSRSCanvas.TINTED_ICON_CACHE.size).toBe(2);
	});
});
