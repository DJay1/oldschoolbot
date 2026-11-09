import { time } from '@oldschoolgg/discord';

import { DOUBLE_LOOT_FINISH_TIME_CACHE, isDoubleLootActive } from '@/lib/bso/doubleLoot.js';
import { DOUBLE_XP_FINISH_TIME_CACHE, isDoubleXpActive } from '@/lib/bso/doubleXp.js';
import { isEventActive, resolveSeasonalEvent } from '@/lib/events/registry.js';

/**
 * Active server-wide boosts for the restart/startup notice (General channel).
 * Skips inactive boosts. Announcements channel stays for rare items / big updates only.
 */
export function startupActiveBoosts(now = Date.now()): string {
	const lines: string[] = [];

	if (isDoubleLootActive()) {
		const ends = new Date(DOUBLE_LOOT_FINISH_TIME_CACHE);
		lines.push(`**Double Loot** ends ${time(ends)} (${time(ends, 'R')})`);
	}

	if (isDoubleXpActive()) {
		const ends = new Date(DOUBLE_XP_FINISH_TIME_CACHE);
		lines.push(`**Double XP** ends ${time(ends)} (${time(ends, 'R')})`);
	}

	if (isEventActive('launch', now)) {
		const event = resolveSeasonalEvent('launch');
		if (event.end !== null) {
			const ends = new Date(event.end);
			lines.push(`**Launch event** ends ${time(ends)} (${time(ends, 'R')})`);
		} else {
			lines.push('**Launch event** is active');
		}
	}

	if (lines.length === 0) return '';
	return `**Active boosts:**\n${lines.join('\n')}`;
}
