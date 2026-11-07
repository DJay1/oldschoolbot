import { randArrItem } from 'node-rng';
import { Items } from 'oldschooljs';

const easterUseTrollItemIDs = new Set([Items.getOrThrow('Magnegg').id, Items.getOrThrow('Wabbit eggs').id]);

const easterUseTrollMessages = [
	'🥚 The egg refuses. It has standards.',
	'🐇 You try that combo. Somewhere, a Wabbit files a complaint.',
	'🤨 The Magnegg looks deeply unimpressed.',
	'🥚 Nothing happens, except a faint sense of being judged.',
	'🐰 The Wabbit eggs rustle mysteriously, then do absolutely nothing.',
	'🫠 You were so preoccupied with whether you could, you never asked whether the egg cared.',
	'🥚 The Magnegg emits a vibe best described as "no."',
	'🐇 A distant bunny laughs at your crafting attempt.',
	'🙄 The eggs decline to participate in whatever this is.',
	'🥚 You tap the items together. The items remain unconvinced.',
	'🐰 The Wabbit union will be hearing about this.',
	'✨ For one brief moment, it almost seems like something might happen. It does not.'
] as const;

export function easterUseTrollResponse(itemIds: number[]): string | null {
	if (!itemIds.some(id => easterUseTrollItemIDs.has(id))) return null;
	return randArrItem(easterUseTrollMessages) ?? easterUseTrollMessages[0];
}
