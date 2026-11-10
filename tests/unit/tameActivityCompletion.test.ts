import { describe, expect, test } from 'vitest';

import { completeLockedTameActivity } from '../../src/lib/util/activityCompletion.js';

function makeTameTx(options: { locked: boolean; onUpdate?: () => void }) {
	let markedComplete = false;
	const tx = {
		$queryRaw: async <T = unknown>(_query: TemplateStringsArray, ..._values: unknown[]): Promise<T> => {
			return (options.locked ? [{ id: 42 }] : []) as T;
		},
		tameActivity: {
			update: async (_args: { where: { id: number }; data: { completed: boolean } }) => {
				options.onUpdate?.();
				markedComplete = true;
			}
		}
	};
	return {
		tx,
		isComplete: () => markedComplete
	};
}

describe('completeLockedTameActivity', () => {
	test('skips a row that is already completed or missing', async () => {
		const { tx, isComplete } = makeTameTx({ locked: false });
		let ran = 0;
		const result = await completeLockedTameActivity({
			tx,
			activityId: 42,
			run: async () => {
				ran += 1;
			},
			onError: () => {
				throw new Error('should not be called');
			}
		});
		expect(result).toBe('skipped');
		expect(ran).toBe(0);
		expect(isComplete()).toBe(false);
	});

	test('marks the row complete only after loot crediting succeeds', async () => {
		const order: string[] = [];
		const { tx, isComplete } = makeTameTx({
			locked: true,
			onUpdate: () => order.push('complete')
		});
		const result = await completeLockedTameActivity({
			tx,
			activityId: 42,
			run: async () => {
				order.push('loot');
			},
			onError: () => {
				throw new Error('should not be called');
			}
		});
		expect(result).toBe('completed');
		expect(isComplete()).toBe(true);
		expect(order).toEqual(['loot', 'complete']);
	});

	test('still marks complete after a task error so a broken trip cannot retry forever', async () => {
		const { tx, isComplete } = makeTameTx({ locked: true });
		const errors: string[] = [];
		const result = await completeLockedTameActivity({
			tx,
			activityId: 42,
			run: async () => {
				throw new Error('task failed');
			},
			onError: err => {
				errors.push(err.message);
			}
		});
		expect(result).toBe('completed');
		expect(isComplete()).toBe(true);
		expect(errors).toEqual(['task failed']);
	});

	test('leaves the row incomplete if the transaction aborts after loot is applied', async () => {
		let ran = false;
		const { tx, isComplete } = makeTameTx({
			locked: true,
			onUpdate: () => {
				throw new Error('transaction rolled back');
			}
		});
		await expect(
			completeLockedTameActivity({
				tx,
				activityId: 42,
				run: async () => {
					ran = true;
				},
				onError: () => {
					throw new Error('should not be called');
				}
			})
		).rejects.toThrow('transaction rolled back');
		expect(ran).toBe(true);
		expect(isComplete()).toBe(false);
	});
});
