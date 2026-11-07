import { customEmoji } from './applicationEmoji.js';

export enum Events {
	Error = 'error',
	Log = 'log',
	Verbose = 'verbose',
	Warn = 'warn',
	Wtf = 'wtf',
	ServerNotification = 'serverNotification',
	SkillLevelUp = 'skillLevelUp',
	EconomyLog = 'economyLog'
}

export type EmojiName =
	| 'MoneyBag'
	| 'OSBot'
	| 'Joy'
	| 'Diamond'
	| 'Dice'
	| 'Fireworks'
	| 'Tick'
	| 'RedX'
	| 'Search'
	| 'FancyLoveheart'
	| 'Gift'
	| 'Sad'
	| 'Happy'
	| 'XP'
	| 'GP'
	| 'ThumbsUp'
	| 'ThumbsDown'
	| 'Casket'
	| 'Agility'
	| 'Cooking'
	| 'Fishing'
	| 'Mining'
	| 'Smithing'
	| 'Woodcutting'
	| 'Runecraft'
	| 'Prayer'
	| 'Construction'
	| 'Diango'
	| 'MysteryBox'
	| 'QuestIcon'
	| 'MinigameIcon'
	| 'Warning'
	| 'Ironman'
	| 'Firemaking'
	| 'Crafting'
	| 'EasterEgg'
	| 'TzRekJad'
	| 'Phoenix'
	| 'TinyTempor'
	| 'AnimatedFireCape'
	| 'Fletching'
	| 'Farming'
	| 'Tangleroot'
	| 'Herblore'
	| 'Purple'
	| 'Green'
	| 'Blue'
	| 'Orange'
	| 'Thieving'
	| 'Hunter'
	| 'Ely'
	| 'Timer'
	| 'ChristmasCracker'
	| 'SantaHat'
	| 'RottenPotato'
	| 'Magic'
	| 'Hitpoints'
	| 'Strength'
	| 'Attack'
	| 'Defence'
	| 'Ranged'
	| 'Dungeoneering'
	| 'Gear'
	| 'Slayer'
	| 'SlayerMasterCape'
	| 'RunecraftMasterCape'
	| 'Flappy'
	| 'CombatAchievements'
	| 'Stopwatch'
	| 'Smokey'
	| 'ItemContract'
	| 'BigOrangeGem'
	| 'GreenGem'
	| 'PinkGem'
	| 'OrangeGem'
	| 'Minion'
	| 'Spanner'
	| 'DoubleSpanner'
	| 'Hammer'
	| 'Bug'
	| 'Trophy'
	| 'Crab'
	| 'Snake'
	| 'Skiller'
	| 'Incinerator'
	| 'CollectionLog'
	| 'Bank'
	| 'Minigames'
	| 'Skull'
	| 'CombatSword'
	| 'SOTW'
	| 'OSRSSkull'
	| 'Invention'
	| 'BSO'
	| 'Kuro'
	| 'EsbCorgi'
	| 'SOTWTrophy'
	| 'ClueScroll'
	| 'DragonTrophy'
	| 'RuneTrophy'
	| 'AdamantTrophy'
	| 'MithrilTrophy'
	| 'SteelTrophy'
	| 'IronTrophy'
	| 'BronzeTrophy';

/**
 * Logical emoji names. Custom ones render as application emojis after
 * `pnpm emojis:sync`, and as a unicode fallback until then.
 */
export const Emoji: { readonly [K in EmojiName]: string } = {
	MoneyBag: customEmoji('MoneyBag'),
	OSBot: customEmoji('OSBot'),
	Joy: '😂',
	Diamond: '💎',
	Dice: customEmoji('dice'),
	Fireworks: '🎆',
	Tick: '✅',
	RedX: '❌',
	Search: '🔎',
	FancyLoveheart: '💝',
	Gift: '🎁',
	Sad: customEmoji('RSSad'),
	Happy: customEmoji('RSHappy'),
	XP: customEmoji('xp'),
	GP: customEmoji('RSGP'),
	ThumbsUp: '👍',
	ThumbsDown: '👎',
	Casket: customEmoji('Casket'),
	Agility: customEmoji('agility'),
	Cooking: customEmoji('cooking'),
	Fishing: customEmoji('fishing'),
	Mining: customEmoji('mining'),
	Smithing: customEmoji('smithing'),
	Woodcutting: customEmoji('woodcutting'),
	Runecraft: customEmoji('runecraft'),
	Prayer: customEmoji('prayer'),
	Construction: customEmoji('construction'),
	Diango: customEmoji('diangoChatHead'),
	MysteryBox: customEmoji('mysterybox'),
	QuestIcon: customEmoji('questIcon'),
	MinigameIcon: customEmoji('minigameIcon'),
	Warning: '⚠️',
	Ironman: customEmoji('ironman'),
	Firemaking: customEmoji('firemaking'),
	Crafting: customEmoji('crafting'),
	EasterEgg: customEmoji('easterEgg'),
	TzRekJad: customEmoji('Tzrekjad'),
	Phoenix: customEmoji('Phoenix'),
	TinyTempor: customEmoji('TinyTempor'),
	AnimatedFireCape: customEmoji('FireCape'),
	Fletching: customEmoji('fletching'),
	Farming: customEmoji('farming'),
	Tangleroot: customEmoji('tangleroot'),
	Herblore: customEmoji('herblore'),
	Purple: '🟪',
	Green: '🟩',
	Blue: '🟦',
	Orange: '🟧',
	Thieving: customEmoji('thieving'),
	Hunter: customEmoji('hunter'),
	Ely: customEmoji('ely'),
	Timer: customEmoji('ehpclock'),
	ChristmasCracker: customEmoji('cracker'),
	SantaHat: customEmoji('santaHat'),
	RottenPotato: customEmoji('rottenPotato'),
	Magic: customEmoji('magic'),
	Hitpoints: customEmoji('hitpoints'),
	Strength: customEmoji('strength'),
	Attack: customEmoji('attack'),
	Defence: customEmoji('defence'),
	Ranged: customEmoji('ranged'),
	Dungeoneering: customEmoji('dungeoneering'),
	Gear: customEmoji('gear'),
	Slayer: customEmoji('slayer'),
	SlayerMasterCape: customEmoji('slayerMasterCape'),
	RunecraftMasterCape: customEmoji('runecraftMasterCape'),
	Flappy: customEmoji('Flappy'),
	CombatAchievements: customEmoji('combatAchievements'),
	Stopwatch: '⏱️',
	Smokey: customEmoji('Smokey'),
	ItemContract: customEmoji('Item_contract'),
	BigOrangeGem: customEmoji('bigOrangeGem'),
	GreenGem: customEmoji('greenGem'),
	PinkGem: customEmoji('pinkGem'),
	OrangeGem: customEmoji('orangeGem'),
	Minion: customEmoji('minion'),
	Spanner: customEmoji('spanner'),
	DoubleSpanner: customEmoji('doubleSpanner'),
	Hammer: customEmoji('hammer'),
	Bug: customEmoji('bug'),
	Trophy: customEmoji('goldTrophy'),
	Crab: customEmoji('crab'),
	Snake: '🐍',
	Skiller: customEmoji('skiller'),
	Incinerator: customEmoji('incinerator'),
	CollectionLog: customEmoji('collectionLog'),
	Bank: customEmoji('bank'),
	Minigames: customEmoji('minigameIcon'),
	Skull: customEmoji('Skull'),
	CombatSword: customEmoji('combat'),
	SOTW: customEmoji('SOTWtrophy'),
	OSRSSkull: customEmoji('skull'),
	Invention: customEmoji('Invention'),
	BSO: customEmoji('BSO'),
	Kuro: customEmoji('kuro'),
	EsbCorgi: customEmoji('esbcorgi'),
	SOTWTrophy: customEmoji('SOTWtrophy'),
	ClueScroll: customEmoji('Clue_scroll'),
	DragonTrophy: customEmoji('DragonTrophy'),
	RuneTrophy: customEmoji('RuneTrophy'),
	AdamantTrophy: customEmoji('AdamantTrophy'),
	MithrilTrophy: customEmoji('MithrilTrophy'),
	SteelTrophy: customEmoji('SteelTrophy'),
	IronTrophy: customEmoji('IronTrophy'),
	BronzeTrophy: customEmoji('BronzeTrophy')
};

/** String form of {@link Emoji}. Values are application-emoji markup or a unicode fallback. */
export type Emoji = (typeof Emoji)[keyof typeof Emoji];
