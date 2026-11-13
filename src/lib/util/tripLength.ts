import { AsyncLocalStorage } from 'node:async_hooks';
import { Time } from '@oldschoolgg/toolkit';

/** Activity multipliers (x2 / x1.5 / x3) only apply to this much of the patron trip bonus. */
export const TRIP_LENGTH_MULTIPLIER_PATRON_CAP_MS = Time.Minute * 10;

/** Queued trips started by /queue are shortened to this length. */
export const QUEUED_TRIP_MAX_DURATION_MS = Time.Hour;

export const QUEUED_TRIP_SHORTENED_MESSAGE = 'Queued trip shortened to 1 hour.';

const QUANTITY_KEYS = new Set(['quantity', 'qty', 'iQty', 'plankQuantity', 'essenceQuantity', 'tiaraQuantity']);

export function patronTripBonusExcessMs(patronBonusMs: number): number {
	if (!Number.isFinite(patronBonusMs) || patronBonusMs <= TRIP_LENGTH_MULTIPLIER_PATRON_CAP_MS) {
		return 0;
	}
	return patronBonusMs - TRIP_LENGTH_MULTIPLIER_PATRON_CAP_MS;
}

/**
 * Apply an activity trip-length multiplier so only (length - patron excess over +10)
 * is multiplied. The leftover patron bonus is added back unmultiplied.
 *
 * `lengthMs` should already include the full patron bonus, and any other boosts
 * that should keep their current order (for example Zak or a log basket).
 */
export function applyTripLengthMultiplier(lengthMs: number, multiplier: number, patronBonusMs: number): number {
	if (!Number.isFinite(lengthMs) || !Number.isFinite(multiplier) || multiplier <= 0) {
		return lengthMs;
	}
	const excess = patronTripBonusExcessMs(patronBonusMs);
	return (lengthMs - excess) * multiplier + excess;
}

type QueuedTripStore = { skipCap: boolean; trimmed: boolean };

const queuedTripContext = new AsyncLocalStorage<QueuedTripStore>();

export function isQueuedTripStart(): boolean {
	return queuedTripContext.getStore() !== undefined;
}

export function wasQueuedTripTrimmed(): boolean {
	return queuedTripContext.getStore()?.trimmed === true;
}

export function markQueuedTripTrimmed(): void {
	const store = queuedTripContext.getStore();
	if (store) store.trimmed = true;
}

export function applyQueuedTripDurationCap(durationMs: number): number {
	const store = queuedTripContext.getStore();
	if (!store || store.skipCap) return durationMs;
	if (durationMs > QUEUED_TRIP_MAX_DURATION_MS) {
		store.trimmed = true;
		return QUEUED_TRIP_MAX_DURATION_MS;
	}
	return durationMs;
}

export async function runInQueuedTripContext<T>(fn: () => Promise<T>, opts?: { skipCap?: boolean }): Promise<T> {
	return queuedTripContext.run({ skipCap: opts?.skipCap ?? false, trimmed: false }, fn);
}

export function scaleCommandQuantities(value: unknown, factor: number): unknown {
	if (!Number.isFinite(factor) || factor <= 0) return value;
	if (Array.isArray(value)) return value.map(item => scaleCommandQuantities(item, factor));
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			if (QUANTITY_KEYS.has(key) && typeof child === 'number' && Number.isFinite(child) && child > 0) {
				out[key] = Math.max(1, Math.floor(child * factor));
			} else {
				out[key] = scaleCommandQuantities(child, factor);
			}
		}
		return out;
	}
	return value;
}

export function findCommandQuantities(value: unknown): number[] {
	const found: number[] = [];
	const walk = (node: unknown) => {
		if (Array.isArray(node)) {
			for (const item of node) walk(item);
			return;
		}
		if (node && typeof node === 'object') {
			for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
				if (QUANTITY_KEYS.has(key) && typeof child === 'number' && Number.isFinite(child) && child > 0) {
					found.push(child);
				} else {
					walk(child);
				}
			}
		}
	};
	walk(value);
	return found;
}

export function storedTripQuantity(data: unknown): number | undefined {
	const found = findCommandQuantities(data);
	return found.length > 0 ? found[0] : undefined;
}

export function trimQueuedTripArgs<T>(opts: { durationMs: number; args: T; storedQuantity?: number }): {
	args: T;
	trimmed: boolean;
	singleUnitExceedsCap: boolean;
} {
	const { durationMs, args, storedQuantity } = opts;
	if (!Number.isFinite(durationMs) || durationMs <= QUEUED_TRIP_MAX_DURATION_MS) {
		return { args, trimmed: false, singleUnitExceedsCap: false };
	}

	const quantities = findCommandQuantities(args);
	const qty = storedQuantity && storedQuantity > 0 ? storedQuantity : Math.max(0, ...quantities);
	const unitTime = qty >= 1 ? durationMs / qty : durationMs;
	const singleUnitExceedsCap = unitTime > QUEUED_TRIP_MAX_DURATION_MS;

	if (singleUnitExceedsCap) {
		if (qty > 1 && quantities.length > 0) {
			return {
				args: scaleCommandQuantities(args, 1 / qty) as T,
				trimmed: false,
				singleUnitExceedsCap: true
			};
		}
		return { args, trimmed: false, singleUnitExceedsCap: true };
	}

	return {
		args: scaleCommandQuantities(args, QUEUED_TRIP_MAX_DURATION_MS / durationMs) as T,
		trimmed: true,
		singleUnitExceedsCap: false
	};
}
