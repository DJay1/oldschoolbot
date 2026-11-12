import { describe, expect, test } from 'vitest';

import {
    appendQueuedTrips,
    dequeueQueuedTrip,
    parseQueuedTrips,
    type QueuedTripGroup
} from '@/lib/bsc/tripQueueState.js';

describe('trip queue state', () => {
    test('preserves mixed activity order and repeated trip counts', () => {
        let queue: QueuedTripGroup[] = [];
        queue = appendQueuedTrips(queue, { activityId: 1, type: 'Farming' }, 1);
        queue = appendQueuedTrips(queue, { activityId: 2, type: 'Agility' }, 1);
        queue = appendQueuedTrips(queue, { activityId: 2, type: 'Agility' }, 2);
        queue = appendQueuedTrips(queue, { activityId: 3, type: 'Farming' }, 1);
        queue = appendQueuedTrips(queue, { activityId: 4, type: 'Agility' }, 2);

        expect(queue).toEqual([
            { activityId: 1, type: 'Farming', count: 1 },
            { activityId: 2, type: 'Agility', count: 3 },
            { activityId: 3, type: 'Farming', count: 1 },
            { activityId: 4, type: 'Agility', count: 2 }
        ]);
    });

    test('dequeues one trip at a time without changing later order', () => {
        const queue: QueuedTripGroup[] = [
            { activityId: 1, type: 'Farming', count: 1 },
            { activityId: 2, type: 'Agility', count: 2 }
        ];

        expect(dequeueQueuedTrip(queue)).toEqual([
            { activityId: 2, type: 'Agility', count: 2 }
        ]);
        expect(dequeueQueuedTrip(queue.slice(1))).toEqual([
            { activityId: 2, type: 'Agility', count: 1 }
        ]);
    });

    test('loads existing single-trip rows using the stored remaining count', () => {
        expect(parseQueuedTrips({ activityId: 12, type: 'Agility' }, 3)).toEqual([
            { activityId: 12, type: 'Agility', count: 3 }
        ]);
    });

    test('loads ordered groups from JSON storage', () => {
        const stored = JSON.stringify([
            { activityId: 1, type: 'Farming', count: 1 },
            { activityId: 2, type: 'Agility', count: 3 }
        ]);

        expect(parseQueuedTrips(stored, 4)).toEqual([
            { activityId: 1, type: 'Farming', count: 1 },
            { activityId: 2, type: 'Agility', count: 3 }
        ]);
    });
});