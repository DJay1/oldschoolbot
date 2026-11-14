import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { ThanksgivingItem } from '@/lib/events/thanksgiving/items.js';
import { baseSnapshotPath } from '../../testConstants.js';

const ICON_DIR = 'src/lib/resources/images/bso_icons';
const NEW_ICON_IDS = [
	ThanksgivingItem.HARVEST_BUNDLE,
	ThanksgivingItem.WICKER_BASKET,
	ThanksgivingItem.BOUNTIFUL_CORNUCOPIA,
	ThanksgivingItem.PILGRIM_HAT,
	ThanksgivingItem.STRAW_HAT,
	ThanksgivingItem.GOBBLES,
	ThanksgivingItem.GOBBLE_GOBBLE,
	ThanksgivingItem.LABOON,
	ThanksgivingItem.LABOON_STRAW_HAT,
	ThanksgivingItem.HARVEST_TURKEY
];
const PET_IDS: number[] = [ThanksgivingItem.GOBBLES, ThanksgivingItem.GOBBLE_GOBBLE];
const LABOON_ICON_IDS: number[] = [ThanksgivingItem.LABOON, ThanksgivingItem.LABOON_STRAW_HAT];

function pngSize(file: string) {
	const b = readFileSync(file);
	return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe('Straw Hat Harvest icons', () => {
	test('event icons: items fit the old Cornucopia box, pets like discontinued pets, Laboon a bit wider', () => {
		const corn = pngSize(path.join(ICON_DIR, `${ThanksgivingItem.CORNUCOPIA_2021}.png`));
		expect(corn).toEqual({ width: 23, height: 17 });
		for (const id of NEW_ICON_IDS) {
			const size = pngSize(path.join(ICON_DIR, `${id}.png`));
			const [maxW, maxH] = PET_IDS.includes(id)
				? [28, 30]
				: LABOON_ICON_IDS.includes(id)
					? [34, 27]
					: id === ThanksgivingItem.HARVEST_TURKEY
						? [36, 32]
						: [corn.width, corn.height];
			expect(size.width, `${id} width`).toBeLessThanOrEqual(maxW);
			expect(size.height, `${id} height`).toBeLessThanOrEqual(maxH);
			expect(Math.max(size.width, size.height), `${id} not tiny`).toBeGreaterThanOrEqual(16);
		}
	});

	test('offer loot bank image renders', async () => {
		const bank = new Bank();
		for (const id of NEW_ICON_IDS) bank.add(id, 3);
		bank.add(ThanksgivingItem.CORNUCOPIA_2021).add('Oak logs', 50).add('Raw lobster', 25);
		const { image } = await bankImageTask.generateBankImage({ bank, title: 'Loot from 5x Bountiful cornucopia' });
		expect(image.length).toBeGreaterThan(0);
		await writeFile(path.join(baseSnapshotPath, 'thanksgiving-offer-loot.png'), image);
	});
});
