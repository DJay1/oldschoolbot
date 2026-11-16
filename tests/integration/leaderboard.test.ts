import { describe, test } from 'vitest';

import { kcGains } from '../../src/mahoji/commands/tools.js';
import { mockInteraction } from '../test-utils/mockInteraction.js';
import { createTestUser } from './util.js';

describe('Leaderboard', async () => {
	test('kcGains Leaderboard', async () => {
		const user = await createTestUser();
		for (const bool of [true, false]) {
			await kcGains(mockInteraction({ user }), 'week', 'zulrah', bool);
		}
	});
});
