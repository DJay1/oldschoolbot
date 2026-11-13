import { describe, expect, test } from 'vitest';

import {
	ACTIVITY_TX_MAX_WAIT_MS,
	ACTIVITY_TX_TIMEOUT_MS,
	activityTxStorage,
	deferTripFinish,
	deferTripFinishMessage,
	isInActivityTransaction,
	wrapPrismaClientWithActivityTx
} from '../../src/lib/util/activityTransaction.js';

describe('activityTransaction ALS', () => {
	test('trip-finish work is deferred until after the activity transaction store is gone', async () => {
		const calls: string[] = [];
		expect(
			deferTripFinish(async () => {
				calls.push('outside');
			})
		).toBe(false);
		expect(calls).toEqual([]);

		const deferredTripFinishes: Array<() => Promise<void>> = [];
		const deferredTripMessages: never[] = [];
		activityTxStorage.run({ tx: {} as never, deferredTripMessages, deferredTripFinishes }, () => {
			expect(isInActivityTransaction()).toBe(true);
			expect(
				deferTripFinish(async () => {
					calls.push('after-commit');
				})
			).toBe(true);
		});

		expect(isInActivityTransaction()).toBe(false);
		expect(calls).toEqual([]);
		expect(deferredTripFinishes).toHaveLength(1);
		await deferredTripFinishes[0]();
		expect(calls).toEqual(['after-commit']);
	});

	test('the prisma proxy uses the transaction client only while the ALS store is active', async () => {
		const real = {
			portent: {
				findMany: async () => ['real']
			},
			$queryRaw: async () => ['real-raw']
		};
		const tx = {
			portent: {
				findMany: async () => ['tx']
			},
			$queryRaw: async () => ['tx-raw']
		};
		const wrapped = wrapPrismaClientWithActivityTx(real as never);

		expect(await wrapped.portent.findMany()).toEqual(['real']);
		expect(await wrapped.$queryRaw`SELECT 1`).toEqual(['real-raw']);

		await activityTxStorage.run(
			{ tx: tx as never, deferredTripMessages: [], deferredTripFinishes: [] },
			async () => {
				expect(await wrapped.portent.findMany()).toEqual(['tx']);
				expect(await wrapped.$queryRaw`SELECT 1`).toEqual(['tx-raw']);
			}
		);

		expect(await wrapped.portent.findMany()).toEqual(['real']);
		expect(await wrapped.$queryRaw`SELECT 1`).toEqual(['real-raw']);
	});

	test('an activity transaction waits long enough for loot writes and is not the 5s Prisma default', () => {
		expect(ACTIVITY_TX_MAX_WAIT_MS).toBeGreaterThanOrEqual(15_000);
		expect(ACTIVITY_TX_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
	});

	test('deferTripFinishMessage still only queues inside a transaction', () => {
		expect(deferTripFinishMessage('1', '2', {} as never)).toBe(false);
		const deferredTripMessages: Array<{ userId: string; channelId: string; message: never }> = [];
		activityTxStorage.run({ tx: {} as never, deferredTripMessages, deferredTripFinishes: [] }, () => {
			expect(deferTripFinishMessage('1', '2', {} as never)).toBe(true);
		});
		expect(deferredTripMessages).toHaveLength(1);
		expect(deferredTripMessages[0]?.userId).toBe('1');
	});
});
