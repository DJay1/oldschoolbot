import '../../src/lib/util/clientSettings.js';

import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { clearPatronDyeCache, setPatronDyeCache } from '../../src/lib/bsc/patronDyes.js';
import { bankImageTask } from '../../src/lib/canvas/bankImage.js';
import { mockMUser } from './userutil.js';

// Timing only: BANK_RENDER_TIMING=1 npx vitest run --config vitest.unit.config.mts tests/unit/bscBankRenderTiming.test.ts
describe.skipIf(!process.env.BANK_RENDER_TIMING)('big bank render timing', () => {
	test('1,900 item bank with 300 dyed items', async () => {
		await bankImageTask.ready;
		const bank = new Bank();
		const ids: number[] = [];
		for (const item of Items.values()) {
			if (ids.length >= 1900) break;
			if (!item.tradeable_on_ge) continue;
			bank.add(item.id, 1 + (item.id % 5000));
			ids.push(item.id);
		}
		const user = mockMUser({ bank });
		setPatronDyeCache(
			user.id,
			ids.slice(0, 300).map((itemID, i) => ({
				itemID,
				dyeKey: 'golden',
				mode: i % 2 ? 'recolour' : 'recolour_glow',
				recolourHex: i % 3 ? '#D4A017' : '#4A3DFF',
				glowHex: '#F5D76A',
				sparkle: false
			})) as any
		);
		const times: number[] = [];
		let last = performance.now();
		let maxBlock = 0;
		const ticker = setInterval(() => {
			const now = performance.now();
			maxBlock = Math.max(maxBlock, now - last);
			last = now;
		}, 5);
		for (let i = 0; i < 4; i++) {
			const start = performance.now();
			const res = await bankImageTask.generateBankImage({ bank, user, flags: { full: 'true' } as any });
			times.push(Math.round(performance.now() - start));
			expect(res.image.length).toBeGreaterThan(0);
		}
		clearInterval(ticker);
		clearPatronDyeCache(user.id);
		console.log(
			`BANK_RENDER_TIMING ms: ${times.join(', ')} | longest event loop block ms: ${Math.round(maxBlock)}`
		);
	}, 120_000);
});
