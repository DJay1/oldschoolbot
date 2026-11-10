import { AsyncLocalStorage } from 'node:async_hooks';

import type { Prisma, PrismaClient } from '@/prisma/main.js';
import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';

/** Wait up to this long to acquire a connection for an activity transaction. */
export const ACTIVITY_TX_MAX_WAIT_MS = 15_000;
/**
 * Keep the interactive transaction open long enough for loot, XP, and CL
 * writes. Trip-finish side effects (messages, portents, queue) must run after
 * commit so this timeout is not spent on Discord or image work.
 */
export const ACTIVITY_TX_TIMEOUT_MS = 250_000;

export type DeferredTripFinish = () => Promise<void>;

type ActivityTxStore = {
	tx: Prisma.TransactionClient;
	deferredTripMessages: Array<{ userId: string; channelId: string; message: MessageBuilderClass }>;
	deferredTripFinishes: DeferredTripFinish[];
};

export const activityTxStorage = new AsyncLocalStorage<ActivityTxStore>();

export function isInActivityTransaction(): boolean {
	return activityTxStorage.getStore() !== undefined;
}

export function deferTripFinishMessage(userId: string, channelId: string, message: MessageBuilderClass): boolean {
	const store = activityTxStorage.getStore();
	if (!store) return false;
	store.deferredTripMessages.push({ userId, channelId, message });
	return true;
}

/**
 * Queue a trip-finish callback to run after the activity transaction commits.
 * Returns true if it was deferred (caller must return immediately).
 */
export function deferTripFinish(run: DeferredTripFinish): boolean {
	const store = activityTxStorage.getStore();
	if (!store) return false;
	store.deferredTripFinishes.push(run);
	return true;
}

export function wrapPrismaClientWithActivityTx(client: PrismaClient): PrismaClient {
	return new Proxy(client, {
		get(target, prop, receiver) {
			const store = activityTxStorage.getStore();
			if (!store) {
				return Reflect.get(target, prop, receiver);
			}
			if (prop === '$transaction') {
				return async (arg: unknown) => {
					if (typeof arg === 'function') {
						return (arg as (tx: Prisma.TransactionClient) => unknown)(store.tx);
					}
					if (Array.isArray(arg)) {
						const results = [];
						for (const op of arg) {
							results.push(await op);
						}
						return results;
					}
					throw new Error('Unsupported prisma.$transaction() call inside an activity transaction');
				};
			}
			const value = Reflect.get(store.tx, prop);
			if (typeof value === 'function') {
				return value.bind(store.tx);
			}
			return value;
		}
	}) as PrismaClient;
}

export async function runInActivityTransaction<T>(
	fn: (tx: Prisma.TransactionClient) => Promise<T>,
	options?: { timeout?: number; maxWait?: number }
): Promise<{
	result: T;
	deferredTripMessages: ActivityTxStore['deferredTripMessages'];
	deferredTripFinishes: DeferredTripFinish[];
}> {
	const deferredTripMessages: ActivityTxStore['deferredTripMessages'] = [];
	const deferredTripFinishes: DeferredTripFinish[] = [];
	const result = await prisma.$transaction(
		async tx => {
			return activityTxStorage.run({ tx, deferredTripMessages, deferredTripFinishes }, () => fn(tx));
		},
		{
			maxWait: options?.maxWait ?? ACTIVITY_TX_MAX_WAIT_MS,
			timeout: options?.timeout ?? ACTIVITY_TX_TIMEOUT_MS
		}
	);
	return { result, deferredTripMessages, deferredTripFinishes };
}
