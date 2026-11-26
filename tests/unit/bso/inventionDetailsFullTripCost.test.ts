import { formatInventionFullTripCostLine } from '@/lib/bso/skills/invention/inventionBoostNotice.js';
import {
	canAffordInventionBoostRaw,
	formatInventionDetails,
	formatInventionDetailsUsageLines,
	Inventions
} from '@/lib/bso/skills/invention/inventions.js';
import { MaterialBank } from '@/lib/bso/skills/invention/MaterialBank.js';

import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

const DISCORD_CONTENT_SAFE_MAX = 2000 - 150;

describe('invention details full-trip cost', () => {
	const mecha = Inventions.find(i => i.name === 'Mecha Rod')!;
	const durationMs = Time.Minute * 30;

	test('shows materials for a 30-minute max trip using the real charge formula', () => {
		const { materialCost } = canAffordInventionBoostRaw(new MaterialBank(), mecha.id, durationMs);
		expect(materialCost.toString()).toEqual('28x Flexible, 28x Organic, 14x Strong');

		const line = formatInventionFullTripCostLine(durationMs, materialCost);
		expect(line).toEqual(
			`Full trip cost for your max trip of ${formatDuration(durationMs)}: 28x Flexible, 28x Organic, 14x Strong. Some activities have a longer max trip, which costs more.`
		);
		expect(line).toContain(formatDuration(durationMs));
		expect(line).not.toMatch(/<@/);
	});

	test('details usage section includes the rate line and the full-trip total', () => {
		const section = formatInventionDetailsUsageLines(mecha, durationMs);
		expect(section).toEqual(
			`\n- Charged per 3 minutes of trip x 0.7 usage\n- Full trip cost for your max trip of ${formatDuration(durationMs)}: 28x Flexible, 28x Organic, 14x Strong. Some activities have a longer max trip, which costs more.`
		);
	});

	test('inventions with no usage cost have no full-trip line', () => {
		expect(formatInventionDetailsUsageLines({ ...mecha, usageCostMultiplier: null }, durationMs)).toEqual('');
	});

	test('details output stays 150 under Discord 2000 and has no pings', () => {
		for (const invention of Inventions) {
			const details = formatInventionDetails(invention, Time.Hour * 5);
			expect(details.length).toBeLessThanOrEqual(DISCORD_CONTENT_SAFE_MAX);
			expect(details).not.toMatch(/<@/);
		}
	});
});
