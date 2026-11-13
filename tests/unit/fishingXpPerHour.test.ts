import { Time } from '@oldschoolgg/toolkit';
import { expect, test } from 'vitest';

import { formatFishingXpPerHour } from '@/lib/skilling/skills/fishing/fishingTrip.js';
import { XPBank } from '@/lib/structures/XPBank.js';

test('fishing XP/hr uses granted amounts and the actual trip duration', () => {
	const duration = Time.Minute * 30;
	const xpBank = new XPBank()
		.add('fishing', 330_562, { duration })
		.add('agility', 30_068, { duration })
		.add('strength', 30_068, { duration });

	expect(formatFishingXpPerHour(xpBank, duration)).toEqual(['661.1k/Hr', '60.1k/Hr Agility', '60.1k/Hr Strength']);
});
