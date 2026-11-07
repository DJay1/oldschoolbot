import { customEmoji, Emoji } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

const xpEmoji = Emoji.XP;
const gpEmoji = Emoji.GP;
const fm = (num: number) => num.toLocaleString();

export interface Pet {
	id: number;
	emoji: string;
	chance: number;
	name: string;
	type: string;
	altNames: string[];
	bossKeys?: string[];
	finish?(): number;
	formatFinish(num: number): string;
}

const pets: Pet[] = [
	{
		id: 1,
		emoji: customEmoji('Baby_chinchompa_red'),
		chance: 95_898,
		name: 'Baby Chinchompa',
		type: 'SKILL',
		altNames: ['CHINCHOMPA', 'BABYCHINCHOMPA', 'CHIN'],
		formatFinish: (num: number) =>
			`You had to catch ${fm(num)} Red Chinchompas to get the Baby Chinchompa Pet! ` +
			`${customEmoji('Baby_chinchompa_red')} You also got...\n${xpEmoji} ${fm(num * 265)} XP\n${gpEmoji} ${fm(
				num * 1318
			)} GP`
	},
	{
		id: 2,
		emoji: customEmoji('Baby_mole'),
		chance: 3000,
		name: 'Baby Mole',
		type: 'BOSS',
		altNames: ['BABYMOLE', 'MOLE', 'GIANTMOLE'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(num)} Giant Moles to get the Baby Mole Pet! ${customEmoji('Baby_mole')}`,
		bossKeys: ['giantMole']
	},
	{
		id: 3,
		emoji: customEmoji('Beaver'),
		chance: 69_846,
		name: 'Beaver',
		type: 'SKILL',
		altNames: ['BEAVER', 'WC', 'WOODCUTTING'],
		formatFinish: (num: number) =>
			`You had to cut ${fm(num)} Magic Logs to get the Beaver Pet! ${customEmoji('Beaver')} ` +
			`You also got...\n${xpEmoji} ${fm(num * 250)} XP\n${gpEmoji} ${fm(num * 1043)} GP`
	},
	{
		id: 4,
		emoji: customEmoji('Bloodhound'),
		chance: 1000,
		name: 'Bloodhound',
		type: 'SPECIAL',
		altNames: ['BLOODHOUND'],
		formatFinish: (num: number) =>
			`You had to complete ${fm(num)} Master Clues to get the Bloodhound Pet! ${customEmoji('Bloodhound')}`
	},
	{
		id: 5,
		emoji: customEmoji('Callisto_cub'),
		chance: 2000,
		name: 'Callisto Cub',
		type: 'BOSS',
		altNames: ['CALLISTO', 'CALLISTOCUB', 'CUB'],
		formatFinish: (num: number) =>
			`You had to slay Callisto ${fm(num)} times to get the Callisto Cub Pet! ${customEmoji('Callisto_cub')}`,
		bossKeys: ['callisto']
	},
	{
		id: 6,
		emoji: customEmoji('Giant_squirrel'),
		chance: 31_965,
		name: 'Giant Squirrel',
		type: 'SKILL',
		altNames: ['SQUIRREL', 'GIANTSQUIRREL', 'AGILITY'],
		formatFinish: (num: number) =>
			`You had to run around the Ardougne Rooftops ${fm(
				num
			)} times to get the Giant Squirrel Pet! ${customEmoji('Giant_squirrel')} You also got...\n${xpEmoji} ${fm(
				num * 570
			)} XP\n${customEmoji('ehpclock')} ${Math.round((num * 45) / 3600)} Hours of your time wasted!`
	},
	{
		id: 7,
		emoji: customEmoji('Heron'),
		chance: 136_108,
		name: 'Heron',
		type: 'SKILL',
		altNames: ['HERON', 'FISHING', 'AGILITY'],
		formatFinish: (num: number) =>
			`You had to catch ${fm(
				num
			)} Monkfish to get the Heron Pet! ${customEmoji('Heron')} You also got...\n${xpEmoji} ${fm(
				num * 120
			)} XP\n${gpEmoji} ${fm(num * 294)} GP`
	},
	{
		id: 8,
		emoji: customEmoji('Kalphite_princess_2nd_form'),
		chance: 3000,
		name: 'Kalphite Princess',
		type: 'BOSS',
		altNames: ['KALPHITE', 'KALPHITEPRINCESS', 'KALPHITEQUEEN', 'KQ'],
		formatFinish: (num: number) =>
			`You had to kill the Kalphite Queen ${fm(
				num
			)} times to get the Kalphite Princess Pet! ${customEmoji('Kalphite_princess_2nd_form')}`,
		bossKeys: ['kalphiteQueen']
	},
	{
		id: 9,
		emoji: customEmoji('Noon'),
		chance: 3000,
		name: 'Noon',
		type: 'BOSS',
		altNames: ['GARGOYLE', 'NOON', 'DAWN', 'GG', 'MIDNIGHT'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(num)} Grotesque Guardians to get the Noon Pet! ${customEmoji('Noon')}`,
		bossKeys: ['grotesqueGuardians']
	},
	{
		id: 10,
		emoji: customEmoji('Olmlet'),
		chance: 3000,
		name: 'Olmlet',
		type: 'BOSS',
		altNames: ['OLMLET', 'RAIDS', 'OLMLET', 'OLM'],
		formatFinish: (num: number) => `You had to do ${fm(num)} Raids to get the Olmlet Pet! ${customEmoji('Olmlet')}`,
		bossKeys: ['chambersofXeric', 'chambersofXericChallengeMode']
	},
	{
		id: 11,
		emoji: customEmoji('Pet_chaos_elemental'),
		chance: 300,
		name: 'Pet chaos elemental',
		type: 'BOSS',
		altNames: ['CHAOSELE', 'CHAOSELEMENTAL'],
		formatFinish: (num: number) =>
			`You had to kill the Chaos Elemental ${fm(
				num
			)} times to get the Chaos Elemental Pet! ${customEmoji('Pet_chaos_elemental')}`,
		bossKeys: ['chaosElemental', 'chaosFanatic']
	},
	{
		id: 12,
		emoji: customEmoji('Pet_dagannoth_prime'),
		chance: 5000,
		name: 'Pet dagannoth prime',
		type: 'BOSS',
		altNames: ['PRIME', 'DAGANNOTHPRIME'],
		formatFinish: (num: number) =>
			`You had to kill Dagannoth Prime ${fm(
				num
			)} times to get the Dagannoth Prime Pet! ${customEmoji('Pet_dagannoth_prime')}`,
		bossKeys: ['dagannothPrime']
	},
	{
		id: 13,
		emoji: customEmoji('Pet_dagannoth_rex'),
		chance: 5000,
		name: 'Pet dagannoth rex',
		type: 'BOSS',
		altNames: ['REX', 'DAGANNOTHREX'],
		formatFinish: (num: number) =>
			`You had to kill Dagannoth Rex ${fm(
				num
			)} times to get the Dagannoth Rex Pet! ${customEmoji('Pet_dagannoth_rex')}`,
		bossKeys: ['dagannothRex']
	},
	{
		id: 14,
		emoji: customEmoji('Pet_dagannoth_supreme'),
		chance: 5000,
		name: 'Pet dagannoth supreme',
		type: 'BOSS',
		altNames: ['SUPREME', 'DAGANNOTHSUPREME'],
		formatFinish: (num: number) =>
			`You had to kill Dagannoth Supreme ${fm(
				num
			)} times to get the Dagannoth Supreme Pet! ${customEmoji('Pet_dagannoth_supreme')}`,
		bossKeys: ['dagannothSupreme']
	},
	{
		id: 15,
		emoji: customEmoji('Pet_dark_core'),
		chance: 5000,
		name: 'Pet dark core',
		type: 'BOSS',
		altNames: ['CORP', 'CORE', 'DARKCORE', 'CORPBEAST'],
		formatFinish: (num: number) =>
			`You had to slay the Corporeal Beast ${fm(
				num
			)} times to get the Dark Core Pet! ${customEmoji('Pet_dark_core')}`,
		bossKeys: ['corporealBeast']
	},
	{
		id: 16,
		emoji: customEmoji('Pet_general_graardor'),
		chance: 5000,
		name: 'Pet general graardor',
		type: 'BOSS',
		altNames: ['BANDOS', 'GRAARDOR'],
		formatFinish: (num: number) =>
			`You had to kill General Graardor ${fm(
				num
			)} times to get the General Graardor Jr. Pet! ${customEmoji('Pet_general_graardor')}`,
		bossKeys: ['generalGraardor']
	},
	{
		id: 17,
		emoji: customEmoji('Pet_kraken'),
		chance: 3000,
		name: 'Pet kraken',
		type: 'BOSS',
		altNames: ['KRAKEN'],
		formatFinish: (num: number) =>
			`You had to slay the Kraken ${fm(num)} times to get the Kraken Pet! ${customEmoji('Pet_kraken')}`,
		bossKeys: ['kraken']
	},
	{
		id: 18,
		emoji: customEmoji('Pet_kreearra'),
		chance: 5000,
		name: "Pet kree'arra",
		type: 'BOSS',
		altNames: ['KREE', 'ARMA', 'ARMADYL', 'KREEARRA'],
		formatFinish: (num: number) =>
			`You had to kill Kree'arra ${fm(num)} times to get the Kree'arra Pet! ${customEmoji('Pet_kreearra')}`,
		bossKeys: ['kreeArra']
	},
	{
		id: 19,
		emoji: customEmoji('Pet_kril_tsutsaroth'),
		chance: 5000,
		name: "Pet k'ril tsutsaroth",
		type: 'BOSS',
		altNames: ['KRILL', 'ZAMMY', 'ZAMORAK', 'KRIL', 'ZAM'],
		formatFinish: (num: number) =>
			`You had to kill K'ril Tsutsaroth ${fm(
				num
			)} times to get the K'ril Tsutsaroth Pet! ${customEmoji('Pet_kril_tsutsaroth')}`,
		bossKeys: ['krilTsutsaroth']
	},
	{
		id: 20,
		emoji: customEmoji('Pet_penance_queen'),
		chance: 1000,
		name: 'Pet Penance Queen',
		type: 'SPECIAL',
		altNames: ['PENANCE', 'PENANCEQUEEN', 'BARB'],
		formatFinish: (num: number) =>
			`You had to do ${fm(
				num
			)} High Level Gambles to get the Penance Queen Pet! ${customEmoji('Pet_penance_queen')}`
	},
	{
		id: 21,
		emoji: customEmoji('Pet_smoke_devil'),
		chance: 3000,
		name: 'Pet Smoke Devil',
		type: 'BOSS',
		altNames: ['SMOKEDEVIL', 'THERMY'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(
				num
			)} Thermonuclear Smoke Devil's to get the Smoke Devil Pet! ${customEmoji('Pet_smoke_devil')}`,
		bossKeys: ['thermonuclearSmokeDevil']
	},
	{
		id: 22,
		emoji: customEmoji('Pet_snakeling'),
		chance: 4000,
		name: 'Pet snakeling',
		type: 'BOSS',
		altNames: ['ZULRAH', 'SNAKELING'],
		formatFinish: (num: number) =>
			`You had to kill Zulrah ${fm(num)} times to get the Snakeling Pet! ${customEmoji('Pet_snakeling')}`,
		bossKeys: ['zulrah']
	},
	{
		id: 23,
		emoji: customEmoji('Pet_zilyana'),
		chance: 5000,
		name: 'Pet zilyana',
		type: 'BOSS',
		altNames: ['SARA', 'SARADOMIN', 'ZILLY', 'ZILYANA'],
		formatFinish: (num: number) =>
			`You had to kill Commander Zilyana ${fm(
				num
			)} times to get the Zilyana Jr. Pet! ${customEmoji('Pet_zilyana')}`,
		bossKeys: ['commanderZilyana']
	},
	{
		id: 24,
		emoji: customEmoji('Phoenix'),
		chance: 5000,
		name: 'Phoenix',
		type: 'SPECIAL',
		altNames: ['PHOENIX', 'PHEONIX', 'WINTERTODT', 'FM'],
		formatFinish: (num: number) =>
			`It took you ${fm(num)} Wintertodt Supply Crate rolls to get the Phoenix Pet! ${customEmoji('Phoenix')}`,
		bossKeys: ['wintertodt']
	},
	{
		id: 25,
		emoji: customEmoji('Prince_black_dragon'),
		chance: 3000,
		name: 'Prince Black Dragon',
		type: 'BOSS',
		altNames: ['KBD', 'KINGBLACKDRAGON', 'PRINCEBLACKDRAGON'],
		formatFinish: (num: number) =>
			`You had to kill the King Black Dragon ${fm(
				num
			)} times to get the Prince Black Dragon Pet! ${customEmoji('Prince_black_dragon')}`,
		bossKeys: ['kingBlackDragon']
	},
	{
		id: 26,
		emoji: customEmoji('Rift_guardian_fire'),
		chance: 1_793_283,
		name: 'Rift Guardian',
		type: 'SKILL',
		altNames: ['RC', 'RIFTGUARDIAN', 'RUNECRAFTING'],
		formatFinish: (num: number) =>
			`You had to craft ${fm(
				num
			)} Nature Runes to get the Rift Guardian Pet! ${customEmoji('Rift_guardian_fire')}`
	},
	{
		id: 27,
		emoji: customEmoji('Rock_golem'),
		chance: 244_725,
		name: 'Rock Golem',
		type: 'SKILL',
		altNames: ['GOLEM', 'ROCKGOLEM', 'MINING'],
		formatFinish: (num: number) =>
			`You had to mine ${fm(
				num
			)} Paydirt at Motherlode Mine to get the Rock Golem Pet! ${customEmoji('Rock_golem')}`
	},
	{
		id: 28,
		emoji: customEmoji('Rocky'),
		chance: 254_736,
		name: 'Rocky',
		type: 'SKILL',
		altNames: ['ROCKY', 'THIEVING', 'RACCOON'],
		formatFinish: (num: number) =>
			`You had to pickpocket that Ardougne Knight ${fm(
				num
			)} times to get the Rocky Pet! ${customEmoji('Rocky')} You also got...\n${xpEmoji} ${fm(
				num * 84
			)} XP\n${gpEmoji} ${fm(num * 100)} GP`
	},
	{
		id: 29,
		emoji: customEmoji('Scorpias_offspring'),
		chance: 2000,
		name: "Scorpia's Offspring",
		type: 'BOSS',
		altNames: ['SCORPIA', 'SCORPION'],
		formatFinish: (num: number) =>
			`You had to kill Scorpia ${fm(
				num
			)} times to get the Scorpia's Offspring Pet! ${customEmoji('Scorpias_offspring')}`,
		bossKeys: ['scorpia']
	},
	{
		id: 30,
		emoji: customEmoji('Skotos'),
		chance: 65,
		name: 'Skotos',
		type: 'BOSS',
		altNames: ['SKOTOS', 'SKOTIZO'],
		formatFinish: (num: number) =>
			`You had to kill Skotizo ${fm(num)} times to get the Skotos Pet! ${customEmoji('Skotos')}`,
		bossKeys: ['skotizo']
	},
	{
		id: 31,
		emoji: customEmoji('Tangleroot'),
		chance: 6893,
		name: 'Tangleroot',
		type: 'SKILL',
		altNames: ['FARMING', 'TANGLEROOT'],
		formatFinish: (num: number) =>
			`You had to harvest ${fm(
				num
			)} Magic Trees to get the Tangleroot Pet! ${customEmoji('Tangleroot')} You also got...\n${xpEmoji} ${fm(
				num * 13_768.3
			)} XP\n${gpEmoji} -${fm(num * 116_894)} GP`
	},
	{
		id: 32,
		emoji: customEmoji('Tzrekjad'),
		chance: 200,
		name: 'Tzrek-Jad',
		type: 'BOSS',
		altNames: ['JAD'],
		formatFinish: (num: number) =>
			`You had to kill Jad ${fm(num)} times to get the TzRek-Jad Pet! ${customEmoji('Tzrekjad')}`,
		bossKeys: ['tzTokJad']
	},
	{
		id: 33,
		emoji: customEmoji('Venenatis_spiderling'),
		chance: 2000,
		name: 'Venenatis Spiderling',
		type: 'BOSS',
		altNames: ['SPIDER', 'VENNY', 'VENENATIS', 'SPIDERLING'],
		formatFinish: (num: number) =>
			`You had to kill Venenatis ${fm(
				num
			)} times to get the Venenatis Spiderling Pet! ${customEmoji('Venenatis_spiderling')}`,
		bossKeys: ['venenatis']
	},
	{
		id: 34,
		emoji: customEmoji('Vetion_jr'),
		chance: 2000,
		name: "Vet'ion jr.",
		type: 'BOSS',
		altNames: ['VETION'],
		formatFinish: (num: number) =>
			`You had to kill Vet'ion ${fm(num)} times to get the Vet'ion Jr. Pet! ${customEmoji('Vetion_jr')}`,
		bossKeys: ['vetion']
	},
	{
		id: 35,
		emoji: customEmoji('Abyssal_orphan'),
		chance: 2560,
		name: 'Abyssal Orphan',
		type: 'BOSS',
		altNames: ['SIRE', 'ABYSSALSIRE', 'ABYSSALOPRHAN'],
		formatFinish: (num: number) =>
			`You had to kill the Abyssal Sire ${fm(
				num
			)} times to get the Abyssal orphan Pet! ${customEmoji('Abyssal_orphan')}`,
		bossKeys: ['abyssalSire']
	},
	{
		id: 36,
		emoji: customEmoji('Hellpuppy'),
		chance: 3000,
		name: 'Hellpuppy',
		type: 'BOSS',
		altNames: ['CERB', 'CERBERUS', 'HELLPUPPY'],
		formatFinish: (num: number) =>
			`You had to kill Cerberus ${fm(num)} times to get the Hellpuppy Pet! ${customEmoji('Hellpuppy')}`,
		bossKeys: ['cerberus']
	},
	{
		id: 37,
		emoji: customEmoji('Chompy_chick'),
		chance: 500,
		name: 'Chompy chick',
		type: 'SPECIAL',
		altNames: ['CHOMPYCHICK'],
		formatFinish: (num: number) =>
			`You had to kill ${fm(num)} Chompy Birds to get the Chompy Chick Pet! ${customEmoji('Chompy_chick')}`
	},
	{
		id: 38,
		emoji: customEmoji('Jalnibrek'),
		chance: 100,
		name: 'Jal-nib-rek',
		type: 'BOSS',
		altNames: ['INFERNO', 'JALNIBREK', 'NIBBLER', 'ZUK'],
		formatFinish: (num: number) =>
			`You had to complete the Inferno ${fm(num)} times to get the Jal-Nib-Rek Pet! ${customEmoji('Jalnibrek')}`,
		bossKeys: ['tzKalZuk']
	},
	{
		id: 39,
		emoji: customEmoji('Herbi'),
		chance: 6500,
		name: 'Herbi',
		type: 'SPECIAL',
		altNames: ['HERBIBOAR', 'HERBI'],
		formatFinish: (num: number) =>
			`You had to track down ${fm(num)} Herbiboars to get the Herbi Pet! ${customEmoji('Herbi')}`
	},
	{
		id: 40,
		emoji: customEmoji('Vorki'),
		chance: 3000,
		name: 'Vorki',
		type: 'SPECIAL',
		altNames: ['VORKI', 'VORKATH'],
		formatFinish: (num: number) =>
			`You had to slay the almighty Vorkath ${fm(num)} times to get the Vorki Pet! ${customEmoji('Vorki')}`,
		bossKeys: ['vorkath']
	},
	{
		id: 41,
		emoji: customEmoji('Lil_zik'),
		chance: 650,
		name: "Lil' Zik",
		type: 'BOSS',
		altNames: ['LILZIK', 'TOB', 'THEATREOFBLOOD', 'ZIK'],
		formatFinish: (num: number) =>
			`You had to complete the Theatre of Blood ${fm(
				num
			)} times to get the Lil' Zik pet! ${customEmoji('Lil_zik')}`,
		bossKeys: ['theatreofBlood']
	},
	{
		id: 42,
		emoji: customEmoji('Ikkle_hydra'),
		chance: 3000,
		name: 'Ikkle hydra',
		type: 'BOSS',
		altNames: ['HYDRA', 'IKKLEHYDRA'],
		formatFinish: (num: number) =>
			`You had to slay the Alchemical Hydra ${fm(
				num
			)} times to get the Ikkle hydra pet! ${customEmoji('Ikkle_hydra')}`,
		bossKeys: ['alchemicalHydra']
	},
	{
		id: 43,
		emoji: customEmoji('Smolcano'),
		chance: 3000,
		name: 'Smolcano',
		type: 'BOSS',
		altNames: ['ZALCANO'],
		formatFinish: (num: number) =>
			`You had to take down Zalcano ${fm(num)} times to get the Smolcano pet! ${customEmoji('Smolcano')}`,
		bossKeys: ['zalcano']
	},
	{
		id: 44,
		emoji: customEmoji('Youngllef'),
		chance: 800,
		name: 'Youngllef',
		type: 'BOSS',
		altNames: ['GAUNTLET', 'YOUNGLEF'],
		formatFinish: (num: number) =>
			`You had to complete the Corrupted Gauntlet ${fm(
				num
			)} times to get the Youngllef pet! ${customEmoji('Youngllef')} This took you ${fm(num * 0.15)} hours.`,
		bossKeys: ['theGauntlet', 'theCorruptedGauntlet']
	},
	{
		id: 45,
		emoji: customEmoji('Sraracha'),
		chance: 3000,
		name: 'Sraracha',
		type: 'BOSS',
		altNames: ['SRARACHA', 'SARACHNIS', 'SARACH'],
		formatFinish: (num: number) =>
			`You had to kill Sarachnis ${fm(num)} times to get the Sraracha pet! ${customEmoji('Sraracha')}`,
		bossKeys: ['sarachnis']
	},
	{
		id: 46,
		emoji: customEmoji('Little_nightmare'),
		chance: 3800,
		name: 'Little nightmare',
		type: 'BOSS',
		altNames: ['NIGHTMARE', 'LILNIGHTMARE'],
		formatFinish: (num: number) =>
			`You had to kill The Nightmare ${fm(
				num
			)} times to get the Little nightmare pet! ${customEmoji('Little_nightmare')}`,
		bossKeys: ['nightmare']
	},
	{
		id: 47,
		emoji: customEmoji('Lil_creator'),
		chance: 400,
		name: "Lil' Creator",
		type: 'SPECIAL',
		altNames: ['LILDESTRUCTOR', 'LILCREATOR', 'SOULWARS'],
		formatFinish: (num: number) =>
			`You had to open ${fm(num)} Spoils of war to get the Lil' Creator! ${customEmoji('Lil_creator')}`,
		bossKeys: ['soulwars']
	},
	{
		id: 48,
		emoji: customEmoji('TinyTempor'),
		chance: 8000,
		name: 'Tiny Tempor',
		type: 'SPECIAL',
		altNames: ['TINYTEMPOR', 'TEMPOROSS'],
		formatFinish: (num: number) =>
			`You had to spend ${fm(num)} Permits to get the Tiny Tempor! ${customEmoji('TinyTempor')}`,
		bossKeys: ['tempoross']
	},
	{
		id: 49,
		emoji: customEmoji('Nexling'),
		chance: 500,
		name: 'Nexling',
		type: 'SPECIAL',
		altNames: ['NEXLING'],
		formatFinish: (num: number) => `You had to kill Nex ${fm(num)} times to get Nexling! ${customEmoji('Nexling')}`
	}
];

for (const pet of pets) {
	Items.getOrThrow(pet.name);
}

export default pets;
