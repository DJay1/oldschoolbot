import { describe, expect, test } from 'vitest';

import { LagSpikeWarner, readLagWindow, startEventLoopMonitor } from '../../src/lib/eventLoopMonitor.js';

const w = (max: number) => ({ p50: 10, p99: max, max, mean: 12 });

describe('event loop lag monitor', () => {
	test('histogram values are reported in ms', () => {
		const h = {
			percentile: (p: number) => (p === 50 ? 10_500_000 : 250_000_000),
			max: 1_234_000_000,
			mean: 20_000_000
		};
		expect(readLagWindow(h as any, 0)).toEqual({ p50: 10.5, p99: 250, max: 1234, mean: 20 });
		// Default subtracts the 20ms sample interval and never goes below 0.
		expect(readLagWindow({ percentile: () => 15_000_000, max: 1_020_000_000, mean: 25_000_000 } as any)).toEqual({
			p50: 0,
			p99: 0,
			max: 1000,
			mean: 5
		});
	});

	test('warns on a spike, then stays quiet during the cooldown and counts what it skipped', () => {
		const warner = new LagSpikeWarner(1000, 60_000);
		expect(warner.check(w(200), 0)).toEqual({ warn: false });
		expect(warner.check(w(3000), 1000)).toEqual({ warn: true, suppressed: 0 });
		expect(warner.check(w(5000), 11_000)).toEqual({ warn: false });
		expect(warner.check(w(2000), 21_000)).toEqual({ warn: false });
		expect(warner.check(w(100), 31_000)).toEqual({ warn: false });
		expect(warner.check(w(1500), 61_001)).toEqual({ warn: true, suppressed: 2 });
	});

	test('starting twice returns the same monitor and stop cleans up', () => {
		const deps = { writePerf: () => {}, warn: () => {} };
		const a = startEventLoopMonitor(deps);
		const b = startEventLoopMonitor(deps);
		expect(b).toBe(a);
		a.stop();
		const c = startEventLoopMonitor(deps);
		expect(c).not.toBe(a);
		c.stop();
	});
});
