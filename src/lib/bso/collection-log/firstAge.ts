import { firstAgeMaxUpgrades } from '@/lib/bso/firstAge/shards.js';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

/**
 * First Age collection log: the tradeable uncharged shard, the account-bound charged shard,
 * and the seven tradeable (max) pieces. Base First Age pieces stay on the clue logs.
 */
export const firstAgeCL: number[] = [
	FirstAgeItem.UNCHARGED_SHARD,
	FirstAgeItem.CHARGED_SHARD,
	...firstAgeMaxUpgrades.map(piece => piece.maxId)
];
