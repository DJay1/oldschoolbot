import { customEmoji, reactionEmoji, resolveEmojiText } from '@oldschoolgg/toolkit';

/** Neutral stand-in for the old minion portrait until a new one is chosen. */
export const MINION_ICON = '👤';

const RETIRED_MINION_EMOJI =
	/<a?:(?:minion|whiteMinion|sapphireMinion|amethystMinion|emeraldMinion|yellowMinion):\d{17,20}>/g;

/** Resolve application emojis, and turn stored old minion portraits into {@link MINION_ICON}. */
export function renderStoredEmoji(value: string): string {
	return resolveEmojiText(value).replace(RETIRED_MINION_EMOJI, MINION_ICON);
}

export const skillEmoji = {
	runecraft: customEmoji('runecraft'),
	firemaking: customEmoji('firemaking'),
	thieving: customEmoji('thieving'),
	mining: customEmoji('mining'),
	ranged: customEmoji('ranged'),
	construction: customEmoji('construction'),
	smithing: customEmoji('smithing'),
	herblore: customEmoji('herblore'),
	attack: customEmoji('attack'),
	strength: customEmoji('strength'),
	defence: customEmoji('defence'),
	fishing: customEmoji('fishing'),
	hitpoints: customEmoji('hitpoints'),
	total: customEmoji('xp'),
	overall: customEmoji('xp'),
	magic: customEmoji('magic'),
	crafting: customEmoji('crafting'),
	agility: customEmoji('agility'),
	fletching: customEmoji('fletching'),
	cooking: customEmoji('cooking'),
	farming: customEmoji('farming'),
	slayer: customEmoji('slayer'),
	prayer: customEmoji('prayer'),
	woodcutting: customEmoji('woodcutting'),
	hunter: customEmoji('hunter'),
	cml: customEmoji('CrystalMathLabs'),
	clock: customEmoji('ehpclock'),
	combat: customEmoji('combat'),
	dungeoneering: customEmoji('dungeoneering'),
	invention: customEmoji('Invention'),
	divination: customEmoji('Divination')
};

export const ReactEmoji = {
	get Happy(): string {
		return reactionEmoji('RSHappy');
	},
	get Sad(): string {
		return reactionEmoji('RSSad');
	},
	Gift: '🎁'
};

export const miscEmojis = {
	barrowsChests: customEmoji('Dharoks_helm'),
	hespori: customEmoji('Bottomless_compost_bucket'),
	bryophyta: customEmoji('Bryophytas_essence'),
	crazyArchaeologist: customEmoji('Fedora'),
	derangedArchaeologist: customEmoji('Fedora'),
	mimic: customEmoji('Casket'),
	obor: customEmoji('Hill_giant_club')
} as const;
