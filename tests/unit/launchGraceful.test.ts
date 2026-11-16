import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { LAUNCH_GRACEFUL_PIECES, LaunchItem } from '@/lib/events/launch/items.js';
import {
	backfillLaunchGracefulRows,
	claimLaunchGracefulSets,
	grantLaunchGracefulSets,
	type LaunchGracefulStore,
	launchGracefulBank,
	launchGracefulSetsEarned,
	launchGracefulSetsOwed
} from '@/lib/events/launch/launchGraceful.js';
import { Gear } from '@/lib/structures/Gear.js';

/** Same rules as the SQL store: only raise, report the old count. */
function memoryStore(): LaunchGracefulStore & { granted: Map<string, number> } {
	const granted = new Map<string, number>();
	return {
		granted,
		async raise(userID, earned) {
			const old = granted.get(userID) ?? 0;
			if (old >= earned) return null;
			granted.set(userID, earned);
			return old;
		}
	};
}

function fakeUser(id: string) {
	const bank = new Bank();
	return {
		id,
		bank,
		transactItems: async ({ itemsToAdd }: { itemsToAdd?: Bank }) => {
			if (itemsToAdd) bank.add(itemsToAdd);
			return {} as any;
		}
	};
}

describe('Launch graceful', () => {
	test('items exist, are tradeable and can never come from mystery boxes', () => {
		for (const [id, name] of LAUNCH_GRACEFUL_PIECES) {
			const item = Items.getOrThrow(id);
			expect(item.name).toBe(name);
			expect(item.tradeable).toBe(true);
			expect(item.customItemData?.cantDropFromMysteryBoxes).toBe(true);
		}
	});

	test('1 set per 50 opened', () => {
		expect(launchGracefulSetsEarned(0)).toBe(0);
		expect(launchGracefulSetsEarned(49)).toBe(0);
		expect(launchGracefulSetsEarned(50)).toBe(1);
		expect(launchGracefulSetsEarned(99)).toBe(1);
		expect(launchGracefulSetsEarned(100)).toBe(2);
		expect(launchGracefulSetsEarned(-5)).toBe(0);
		expect(launchGracefulSetsOwed(150, 1)).toBe(2);
		expect(launchGracefulSetsOwed(150, 5)).toBe(0);
		expect(launchGracefulBank(2).amount('Launch graceful hood')).toBe(2);
		expect(launchGracefulBank(2).length).toBe(6);
	});

	test('one open that crosses several thresholds gives every set at once', async () => {
		const store = memoryStore();
		expect(await claimLaunchGracefulSets('a', 49, store)).toBe(0);
		// 49 -> 201 opened in one /open crosses 50, 100, 150 and 200.
		expect(await claimLaunchGracefulSets('a', 201, store)).toBe(4);
		expect(await claimLaunchGracefulSets('a', 249, store)).toBe(0);
		expect(await claimLaunchGracefulSets('a', 250, store)).toBe(1);
	});

	test('replaying the same opened count never pays twice', async () => {
		const store = memoryStore();
		const user = fakeUser('b');
		const first = await grantLaunchGracefulSets(user, 120, store);
		expect(first?.amount(LaunchItem.LAUNCH_GRACEFUL_HOOD)).toBe(2);
		expect(await grantLaunchGracefulSets(user, 120, store)).toBeNull();
		// Trading the sets away doesn't matter: only the opened count is checked.
		user.bank.remove(launchGracefulBank(2));
		expect(await grantLaunchGracefulSets(user, 120, store)).toBeNull();
		expect(store.granted.get('b')).toBe(2);
	});

	test('backfill pays current players once and is safe to rerun', async () => {
		const store = memoryStore();
		const users = new Map(['x', 'y', 'z'].map(id => [id, fakeUser(id)]));
		const rows = [
			{ user_id: 'x', opened: 50 },
			{ user_id: 'y', opened: 175 },
			{ user_id: 'z', opened: 20 }
		];
		const fetch = async (id: string) => users.get(id)!;
		expect(await backfillLaunchGracefulRows(rows, fetch, store)).toEqual({ users: 2, sets: 4 });
		expect(await backfillLaunchGracefulRows(rows, fetch, store)).toEqual({ users: 0, sets: 0 });
		expect(users.get('x')!.bank.amount('Launch graceful cape')).toBe(1);
		expect(users.get('y')!.bank.amount('Launch graceful cape')).toBe(3);
		expect(users.get('z')!.bank.length).toBe(0);
		// A later open only pays the newly earned set.
		expect(await claimLaunchGracefulSets('y', 200, store)).toBe(1);
	});

	test('Launch graceful counts as a full Graceful set, with the Corgo party hat as the hood', () => {
		const set = [
			'Graceful hood',
			'Graceful top',
			'Graceful legs',
			'Graceful boots',
			'Graceful gloves',
			'Graceful cape'
		];
		const launch = new Gear({
			head: 'Launch graceful hood',
			body: 'Launch graceful top',
			legs: 'Launch graceful legs',
			feet: 'Launch graceful boots',
			hands: 'Launch graceful gloves',
			cape: 'Launch graceful cape'
		});
		expect(launch.hasEquipped(set, true)).toBe(true);
		const withHat = new Gear({
			head: 'Corgo party hat',
			body: 'Launch graceful top',
			legs: 'Launch graceful legs',
			feet: 'Launch graceful boots',
			hands: 'Launch graceful gloves',
			cape: 'Launch graceful cape'
		});
		expect(withHat.hasEquipped(set, true)).toBe(true);
		const noHood = new Gear({
			body: 'Launch graceful top',
			legs: 'Launch graceful legs',
			feet: 'Launch graceful boots',
			hands: 'Launch graceful gloves',
			cape: 'Launch graceful cape'
		});
		expect(noHood.hasEquipped(set, true)).toBe(false);
	});
});
