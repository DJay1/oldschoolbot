import { medianSorted, quantileSorted } from 'simple-statistics';

export interface DiscontinuedSale {
	price: number;
	quantity: number;
	date: Date;
	sellerID: string | null;
	buyerID: string | null;
}

export type SaleAnomaly =
	| 'far above other sales'
	| 'far below other sales'
	| 'same buyer and seller traded it repeatedly';

function priceAnomaly(price: number, median: number): SaleAnomaly | null {
	if (median <= 0) return null;
	if (price > median * 2) return 'far above other sales';
	if (price < median / 2) return 'far below other sales';
	return null;
}

export function findSaleAnomalies(sales: DiscontinuedSale[]): Map<number, SaleAnomaly[]> {
	const anomalies = new Map<number, SaleAnomaly[]>();
	const flag = (index: number, reason: SaleAnomaly) => {
		const existing = anomalies.get(index) ?? [];
		if (!existing.includes(reason)) existing.push(reason);
		anomalies.set(index, existing);
	};

	const sortedPrices = sales.map(sale => sale.price).sort((a, b) => a - b);
	if (sales.length >= 4) {
		const q1 = quantileSorted(sortedPrices, 0.25);
		const q3 = quantileSorted(sortedPrices, 0.75);
		const iqr = q3 - q1;
		const median = medianSorted(sortedPrices);
		sales.forEach((sale, index) => {
			if (sale.price >= q1 - 1.5 * iqr && sale.price <= q3 + 1.5 * iqr) return;
			const reason = priceAnomaly(sale.price, median);
			if (reason) flag(index, reason);
		});
	} else if (sales.length === 3) {
		const median = medianSorted(sortedPrices);
		sales.forEach((sale, index) => {
			if (sale.price > median * 3) flag(index, 'far above other sales');
			else if (sale.price < median / 3) flag(index, 'far below other sales');
		});
	}

	const salesByPair = new Map<string, number[]>();
	sales.forEach((sale, index) => {
		if (!sale.sellerID || !sale.buyerID) return;
		const key = `${sale.sellerID}:${sale.buyerID}`;
		salesByPair.set(key, [...(salesByPair.get(key) ?? []), index]);
	});
	for (const indexes of salesByPair.values()) {
		if (indexes.length >= 3 || (indexes.length >= 2 && indexes.length > sales.length / 2)) {
			for (const index of indexes) flag(index, 'same buyer and seller traded it repeatedly');
		}
	}

	return anomalies;
}
