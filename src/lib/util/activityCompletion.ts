/**
 * Completes one due activity without marking it complete first.
 * Loot writes and the completed flag happen in the same transaction, so a
 * crash rolls both back and a restart can safely retry. A thrown error is
 * logged, then the transaction still commits whatever work finished and
 * marks the row complete so a broken task cannot retry forever.
 */
export async function completeLockedActivity(options: {
	tx: {
		$queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
		activity: {
			update: (args: { where: { id: number }; data: { completed: boolean } }) => Promise<unknown>;
		};
	};
	activityId: number;
	run: () => Promise<void>;
	onError: (err: Error) => void | Promise<void>;
}): Promise<'skipped' | 'completed'> {
	const rows = await options.tx.$queryRaw<Array<{ id: number }>>`
		SELECT id FROM activity WHERE id = ${options.activityId} AND completed = false FOR UPDATE
	`;
	if (rows.length === 0) return 'skipped';

	try {
		await options.run();
	} catch (err) {
		await options.onError(err as Error);
	}

	await options.tx.activity.update({
		where: { id: options.activityId },
		data: { completed: true }
	});
	return 'completed';
}

type TameActivityTx = {
	$queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
	tameActivity: {
		update: (args: { where: { id: number }; data: { completed: boolean } }) => Promise<unknown>;
	};
};

/**
 * Completes one due tame activity without marking it complete first.
 * Same crash-safe contract as completeLockedActivity: loot and the completed
 * flag share a transaction, and a task error is logged then still marked done.
 */
export async function completeLockedTameActivity(options: {
	tx: TameActivityTx;
	activityId: number;
	run: () => Promise<void>;
	onError: (err: Error) => void | Promise<void>;
}): Promise<'skipped' | 'completed'> {
	const rows = await options.tx.$queryRaw<Array<{ id: number }>>`
		SELECT id FROM tame_activity WHERE id = ${options.activityId} AND completed = false FOR UPDATE
	`;
	if (rows.length === 0) return 'skipped';

	try {
		await options.run();
	} catch (err) {
		await options.onError(err as Error);
	}

	await options.tx.tameActivity.update({
		where: { id: options.activityId },
		data: { completed: true }
	});
	return 'completed';
}
