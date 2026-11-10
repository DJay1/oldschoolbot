import { MTame } from '@/lib/bso/structures/MTame.js';
import { runTameTask } from '@/lib/bso/tames/tameTasks.js';

import type { Tame, TameActivity } from '@/prisma/main.js';
import { testingShortcutsEnabled } from '@/lib/constants.js';
import { completeLockedTameActivity } from '@/lib/util/activityCompletion.js';
import { runInActivityTransaction } from '@/lib/util/activityTransaction.js';
import { deliverTripFinishMessage } from '@/lib/util/deliverTripFinishMessage.js';

type DueTameActivity = TameActivity & { tame: Tame };

class STameActivityManager {
	private inFlight = new Map<number, Promise<void>>();

	async completeTameActivity(task: DueTameActivity): Promise<void> {
		const { deferredTripMessages, deferredTripFinishes } = await runInActivityTransaction(async tx => {
			return completeLockedTameActivity({
				tx,
				activityId: task.id,
				run: () => runTameTask(task, new MTame(task.tame)),
				onError: async err => {
					Logging.logError(err, {
						type: 'TAME_ACTIVITY_ERROR',
						user_id: task.user_id,
						tame_id: String(task.tame_id),
						activity_id: String(task.id),
						channel_id: task.channel_id ?? undefined
					});
				}
			});
		});

		for (const run of deferredTripFinishes) {
			try {
				await run();
			} catch (err) {
				Logging.logError(err as Error, {
					source: 'deferredTameTripFinish',
					user_id: String(task.user_id),
					activity_id: String(task.id)
				});
			}
		}

		for (const pending of deferredTripMessages) {
			await deliverTripFinishMessage(pending.userId, pending.channelId, pending.message);
		}
	}

	async processPendingActivities(): Promise<void> {
		if (typeof globalThis.globalClient !== 'undefined' && globalClient.isShuttingDown) {
			return;
		}

		const tameTasks = await prisma.tameActivity.findMany({
			where: {
				finish_date: testingShortcutsEnabled()
					? undefined
					: {
							lt: new Date()
						},
				completed: false
			},
			include: {
				tame: true
			},
			take: 5
		});

		await Promise.all(
			tameTasks.map(task => {
				const existing = this.inFlight.get(task.id);
				if (existing) return existing;
				const work = this.completeTameActivity(task).finally(() => this.inFlight.delete(task.id));
				this.inFlight.set(task.id, work);
				return work;
			})
		);
	}

	async drain(options?: { timeoutMs?: number }): Promise<void> {
		const pending = [...this.inFlight.values()];
		if (pending.length === 0) return;
		const timeoutMs = options?.timeoutMs ?? 25_000;
		await Promise.race([Promise.allSettled(pending), new Promise<void>(resolve => setTimeout(resolve, timeoutMs))]);
	}
}

const TameActivityManagerSingleton = new STameActivityManager();

export const TameActivityManager = TameActivityManagerSingleton;
