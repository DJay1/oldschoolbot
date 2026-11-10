import { AsyncLocalStorage } from 'node:async_hooks';

import type { Prisma, PrismaClient } from '@/prisma/main.js';
import type { MessageBuilderClass } from '@/discord/MessageBuilder.js';

type ActivityTxStore = {
	tx: Prisma.TransactionClient;
	deferredTripMessages: Array<{ userId: string; channelId: string; message: MessageBuilderClass }>;
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
): Promise<{ result: T; deferredTripMessages: ActivityTxStore['deferredTripMessages'] }> {
	const deferredTripMessages: ActivityTxStore['deferredTripMessages'] = [];
	const result = await prisma.$transaction(
		async tx => {
			return activityTxStorage.run({ tx, deferredTripMessages }, () => fn(tx));
		},
		{
			maxWait: options?.maxWait ?? 15_000,
			timeout: options?.timeout ?? 250_000
		}
	);
	return { result, deferredTripMessages };
}
