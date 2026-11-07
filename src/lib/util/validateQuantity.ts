import { evalMathExpression, UserError } from '@oldschoolgg/toolkit';

/** Largest quantity accepted for buy, sell, spend, and trade operations. */
export const MAX_QUANTITY = 1_000_000_000;

/** Postgres signed 32-bit integer limit. Point currencies use this column type. */
export const MAX_INT32 = 2_147_483_647;

/** Default upper bound for a single shop purchase. */
export const MAX_SHOP_QUANTITY = 100_000;

export type QuantityValidation = { ok: true; value: number } | { ok: false; error: string };

export function validateQuantity(
	input: unknown,
	options?: { min?: number; max?: number; label?: string }
): QuantityValidation {
	const min = options?.min ?? 1;
	const max = options?.max ?? MAX_QUANTITY;
	const label = options?.label ?? 'Quantity';
	const value = readWholeNumber(input);
	if (value === null) {
		return { ok: false, error: `${label} must be a whole number.` };
	}
	if (value < min) {
		return { ok: false, error: `${label} must be at least ${min.toLocaleString()}.` };
	}
	if (value > max) {
		return { ok: false, error: `${label} cannot be more than ${max.toLocaleString()}.` };
	}
	return { ok: true, value };
}

/**
 * Accepts a missing quantity as `fallback` (default 1). Explicit values must be valid.
 */
export function requirePositiveQuantity(
	quantity: number | null | undefined,
	options?: { max?: number; label?: string; fallback?: number }
): QuantityValidation {
	if (quantity === undefined || quantity === null) {
		return validateQuantity(options?.fallback ?? 1, options);
	}
	return validateQuantity(quantity, options);
}

/**
 * Multiplies two whole numbers and rejects results outside `max`.
 * A unit of 0 is allowed and produces 0.
 */
export function safePositiveProduct(unit: number, quantity: number, max = MAX_INT32): QuantityValidation {
	if (!Number.isSafeInteger(unit) || unit < 0) {
		return { ok: false, error: 'Invalid cost.' };
	}
	const qty = validateQuantity(quantity, { min: 1, max, label: 'Quantity' });
	if (!qty.ok) return qty;
	if (unit === 0) return { ok: true, value: 0 };
	if (qty.value > Math.floor(max / unit)) {
		return { ok: false, error: 'That quantity is too large.' };
	}
	return { ok: true, value: unit * qty.value };
}

export type NumericAmount = number | bigint;

export interface PreparedNumericUpdate {
	decrements: { field: string; amount: NumericAmount }[];
	rest: Record<string, unknown>;
}

/**
 * Splits a Prisma-style update into checked removals and the remaining write.
 * Removals must be positive whole numbers. A negative removal is rejected here,
 * before any database call.
 */
export function prepareNumericUpdate(data: Record<string, unknown>): PreparedNumericUpdate {
	const decrements: { field: string; amount: NumericAmount }[] = [];
	const rest: Record<string, unknown> = {};
	for (const [field, value] of Object.entries(data)) {
		if (value === undefined) continue;
		const classified = classifyField(field, value);
		if (classified.kind === 'plain') {
			rest[field] = value;
			continue;
		}
		if (classified.kind === 'noop') continue;
		if (classified.kind === 'increment') {
			rest[field] = { increment: classified.amount };
			continue;
		}
		decrements.push({ field, amount: classified.amount });
	}
	return { decrements, rest };
}

export async function applyBalanceDecrements(
	updateMany: (args: { where: object; data: object }) => Promise<{ count: number }>,
	where: object,
	decrements: { field: string; amount: NumericAmount }[]
) {
	for (const decrement of decrements) {
		const result = await updateMany({
			where: { ...where, [decrement.field]: { gte: decrement.amount } },
			data: { [decrement.field]: { decrement: decrement.amount } }
		});
		if (result.count !== 1) {
			throw new UserError(`You don't have enough ${decrement.field.replaceAll('_', ' ')}.`);
		}
	}
}

function readWholeNumber(input: unknown): number | null {
	if (typeof input === 'bigint') {
		if (input > BigInt(Number.MAX_SAFE_INTEGER) || input < BigInt(Number.MIN_SAFE_INTEGER)) return null;
		input = Number(input);
	}
	if (typeof input === 'string') {
		const trimmed = input.trim();
		if (!trimmed) return null;
		const parsed = evalMathExpression(trimmed);
		if (parsed === null) return null;
		input = parsed;
	}
	if (typeof input !== 'number' || !Number.isSafeInteger(input)) return null;
	return input;
}

function invalidBalanceUpdate(): never {
	throw new UserError('Quantity must be a positive whole number.');
}

function classifyField(
	field: string,
	value: unknown
):
	| { kind: 'plain' }
	| { kind: 'noop' }
	| { kind: 'increment'; amount: NumericAmount }
	| { kind: 'decrement'; amount: NumericAmount } {
	if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Date) {
		return { kind: 'plain' };
	}
	const record = value as Record<string, unknown>;
	const hasIncrement = Object.hasOwn(record, 'increment');
	const hasDecrement = Object.hasOwn(record, 'decrement');
	if (!hasIncrement && !hasDecrement) return { kind: 'plain' };
	if (hasIncrement && hasDecrement) invalidBalanceUpdate();
	if (hasDecrement) {
		const amount = readRemoval(record.decrement, field);
		if (amount === 'noop') return { kind: 'noop' };
		return { kind: 'decrement', amount };
	}
	const addition = readAddition(record.increment, field);
	if (addition === 'noop') return { kind: 'noop' };
	if (typeof addition === 'object') return { kind: 'decrement', amount: addition.amount };
	return { kind: 'increment', amount: addition };
}

function readRemoval(raw: unknown, field: string): NumericAmount | 'noop' {
	if (typeof raw === 'bigint') {
		if (raw === 0n) return 'noop';
		if (raw < 0n) invalidBalanceUpdate();
		return raw;
	}
	if (typeof raw === 'number') {
		if (!Number.isFinite(raw) || !Number.isSafeInteger(raw)) invalidBalanceUpdate();
		if (raw === 0) return 'noop';
		if (raw < 0) invalidBalanceUpdate();
		return field === 'GP' ? BigInt(raw) : raw;
	}
	invalidBalanceUpdate();
}

function readAddition(raw: unknown, field: string): NumericAmount | 'noop' | { amount: NumericAmount } {
	if (typeof raw === 'bigint') {
		if (raw === 0n) return 'noop';
		if (raw < 0n) {
			if (field !== 'GP') invalidBalanceUpdate();
			return { amount: -raw };
		}
		return raw;
	}
	if (typeof raw === 'number') {
		if (!Number.isFinite(raw)) invalidBalanceUpdate();
		if (raw === 0) return 'noop';
		if (raw < 0) {
			if (field !== 'GP' || !Number.isSafeInteger(raw)) invalidBalanceUpdate();
			return { amount: BigInt(-raw) };
		}
		return raw;
	}
	invalidBalanceUpdate();
}
