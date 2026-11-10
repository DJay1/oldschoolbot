import { autocompleteMonsters } from '@/lib/minions/data/killableMonsters/index.js';

const MONSTER_ACTIVITY_TYPES = new Set(['MonsterKilling', 'GroupMonsterKilling']);

export function formatActivityTypeName(type: string): string {
	return type.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
}

function asRecord(data: unknown): Record<string, unknown> | null {
	if (!data) return null;
	if (typeof data === 'string') {
		try {
			const parsed = JSON.parse(data) as unknown;
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
		} catch {
			return null;
		}
	}
	if (typeof data === 'object') return data as Record<string, unknown>;
	return null;
}

function monsterNameFromData(data: unknown): string | null {
	const record = asRecord(data);
	const raw = record?.mi;
	const monsterId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
	if (!Number.isFinite(monsterId)) return null;
	return autocompleteMonsters.find(monster => monster.id === monsterId)?.name ?? null;
}

/** Human label for a queued/recent trip, e.g. 'General Graardor' instead of 'Monster Killing'. */
export function formatQueuedTripLabel(type: string, data?: unknown): string {
	if (MONSTER_ACTIVITY_TYPES.has(type)) {
		const monsterName = monsterNameFromData(data);
		if (monsterName) return monsterName;
	}
	return formatActivityTypeName(type);
}
