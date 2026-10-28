import { firstAgeAffinities, firstAgeMaxUpgrades } from '@/lib/bso/firstAge/affinities.js';

import { FirstAgeItem } from '@/lib/customItems/firstAge.js';

/**
 * First Age collection log: affinity shards, one token per outfit, the max seal,
 * and the seven tradeable (max) pieces. Base First Age pieces stay on the clue logs.
 */
export const firstAgeCL: number[] = [
	FirstAgeItem.AFFINITY_SHARD,
	...firstAgeAffinities.map(affinity => affinity.tokenId),
	FirstAgeItem.MAX_SEAL,
	...firstAgeMaxUpgrades.map(piece => piece.maxId)
];
