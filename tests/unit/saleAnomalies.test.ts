import { describe, expect, test } from 'vitest';

import { type DiscontinuedSale, findSaleAnomalies } from '@/lib/util/saleAnomalies.js';

let nextTraderID = 0;

function sale(price: number, sellerID?: string, buyerID?: string): DiscontinuedSale {
	return {
		price,
		quantity: 1,
		date: new Date('2026-11-01T00:00:00.000Z'),
		sellerID: sellerID ?? `seller${nextTraderID++}`,
		buyerID: buyerID ?? `buyer${nextTraderID++}`
	};
}

describe('findSaleAnomalies', () => {
	test('no sales and a single sale are never flagged', () => {
		expect(findSaleAnomalies([]).size).toBe(0);
		expect(findSaleAnomalies([sale(1)]).size).toBe(0);
	});

	test('normal spread of prices is not flagged', () => {
		const sales = [100, 110, 95, 105, 120, 90].map(price => sale(price * 1_000_000));
		expect(findSaleAnomalies(sales).size).toBe(0);
	});

	test('a sale far above the rest is flagged', () => {
		const sales = [100, 110, 95, 105, 120, 2000].map(price => sale(price * 1_000_000));
		const anomalies = findSaleAnomalies(sales);
		expect([...anomalies.keys()]).toEqual([5]);
		expect(anomalies.get(5)).toEqual(['far above other sales']);
	});

	test('a 1 GP sale is flagged as far below', () => {
		const sales = [sale(100_000_000), sale(110_000_000), sale(1), sale(95_000_000), sale(105_000_000)];
		const anomalies = findSaleAnomalies(sales);
		expect([...anomalies.keys()]).toEqual([2]);
		expect(anomalies.get(2)).toEqual(['far below other sales']);
	});

	test('identical prices with a small difference are not flagged', () => {
		const sales = [100, 100, 100, 105].map(price => sale(price * 1_000_000));
		expect(findSaleAnomalies(sales).size).toBe(0);
	});

	test('with three sales, one more than 3x the others is flagged', () => {
		const sales = [sale(10_000_000), sale(12_000_000), sale(50_000_000)];
		expect([...findSaleAnomalies(sales).keys()]).toEqual([2]);
	});

	test('with three sales, one far below the others is flagged', () => {
		const sales = [sale(100_000_000), sale(1), sale(90_000_000)];
		const anomalies = findSaleAnomalies(sales);
		expect([...anomalies.keys()]).toEqual([1]);
		expect(anomalies.get(1)).toEqual(['far below other sales']);
	});

	test('the same buyer and seller trading three times is flagged', () => {
		const sales = [
			sale(100_000_000, 'alice', 'bob'),
			sale(100_000_000, 'alice', 'bob'),
			sale(100_000_000, 'alice', 'bob'),
			sale(100_000_000),
			sale(100_000_000),
			sale(100_000_000),
			sale(100_000_000)
		];
		const anomalies = findSaleAnomalies(sales);
		expect([...anomalies.keys()].sort()).toEqual([0, 1, 2]);
		expect(anomalies.get(0)).toEqual(['same buyer and seller traded it repeatedly']);
	});

	test('the same pair making most of only a few sales is flagged', () => {
		const sales = [sale(5_000_000, 'alice', 'bob'), sale(5_000_000, 'alice', 'bob'), sale(5_000_000)];
		expect([...findSaleAnomalies(sales).keys()].sort()).toEqual([0, 1]);
	});

	test('one repeat pair among many sales is not flagged', () => {
		const sales = [
			sale(5_000_000, 'alice', 'bob'),
			sale(5_000_000, 'alice', 'bob'),
			sale(5_000_000),
			sale(5_000_000),
			sale(5_000_000)
		];
		expect(findSaleAnomalies(sales).size).toBe(0);
	});
});
