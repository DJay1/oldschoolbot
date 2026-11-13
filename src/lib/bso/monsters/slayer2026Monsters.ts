import type { CustomMonster } from '@/lib/bso/monsters/CustomMonster.js';
import { setCustomMonster } from '@/lib/bso/monsters/setCustomMonster.js';
import { Slayer2026MonsterID } from '@/lib/bso/monsters/slayer2026Ids.js';

import { GearStat } from '@oldschoolgg/gear';
import { Time } from '@oldschoolgg/toolkit';
import { GemTable, HerbDropTable, itemID, LootTable, MonsterAttribute, Monsters } from 'oldschooljs';

import { BloodMoonItem } from '@/lib/customItems/bloodMoon.js';
import { ShellbaneItem, Slayer2026Item } from '@/lib/customItems/slayer2026.js';
import { QuestID } from '@/lib/minions/data/quests.js';

function crushBoosts() {
	return {
		[itemID('Drygore mace')]: 12,
		[itemID("Inquisitor's mace")]: 8,
		[itemID('Elder maul')]: 6
	};
}

function superiorTable(base: LootTable) {
	return new LootTable()
		.every(base, 3)
		.tertiary(13, 'Clue scroll (hard)')
		.tertiary(215, 'Mist battlestaff')
		.tertiary(215, 'Dust battlestaff')
		.tertiary(754, 'Eternal gem')
		.tertiary(754, 'Imbued heart');
}

const GryphonTable = new LootTable({ limit: 128 })
	.every('Bones')
	.every('Gryphon feather', [1, 3])
	.add('Onion', 1, 10)
	.add('Strawberry', 1, 10)
	.add('Watermelon', 1, 10)
	.add('Raw lobster', 1, 10)
	.add('Raw swordfish', 1, 10)
	.add('Raw shark', 1, 8)
	.add('Potato', 1, 8)
	.add('Cabbage', 1, 1)
	.add('Tomato', 1, 1)
	.add('Sweetcorn', 1, 1)
	.add('Potato seed', [1, 4], 6)
	.add('Onion seed', [1, 3], 3)
	.add('Cabbage seed', [1, 3], 2)
	.add('Tomato seed', [1, 2], 1)
	.add(HerbDropTable, 1, 11)
	.add('Gryphon feather', [10, 25], 17)
	.add('Mithril cannonball', [8, 12], 6)
	.add('Adamant cannonball', [5, 9], 2)
	.add('Basket', 1, 4)
	.add('Empty sack', 1, 4)
	.add('Elkhorn frag', 1, 1)
	.add('Pillar frag', 1, 1)
	.add(GemTable, 1, 1)
	.tertiary(100, 'Clue scroll (hard)')
	.tertiary(2500, Slayer2026Item.HORN_OF_PLENTY);

const AquaniteTable = new LootTable({ limit: 128 })
	.every('Big bones')
	.tertiary(750, 'Aquanite tendon')
	.add('Water rune', [150, 350], 10)
	.add('Rune cannonball', [14, 22], 2)
	.add('Dragon cannonball', [9, 15], 1)
	.add('Ranarr seed', 1, 8)
	.add('Irit seed', 1, 8)
	.add('Avantoe seed', 1, 8)
	.add('Kwuarm seed', 1, 8)
	.add('Cadantine seed', 1, 8)
	.add('Snape grass seed', [1, 2], 6)
	.add('Watermelon seed', [3, 5], 6)
	.add('Pineapple seed', 1, 6)
	.add('Elkhorn frag', [2, 4], 6)
	.add('Pillar frag', [1, 3], 6)
	.add('Umbral frag', 1, 6)
	.add('Snape grass', [1, 2], 10)
	.add('Seaweed', 1, 10)
	.add('Shark lure', [3, 5], 6)
	.add('Water battlestaff', 1, 6)
	.add('Coins', [100, 200], 4)
	.add('Uncut diamond', 1, 3)
	.tertiary(125, 'Clue scroll (hard)')
	.tertiary(400, 'Long bone')
	.tertiary(5013, 'Curved bone');

const TarnishedTable = new LootTable()
	.add(Slayer2026Item.TARNISHED_SPEAR, 1, 6)
	.add(Slayer2026Item.TARNISHED_RING, 1, 4)
	.add(Slayer2026Item.TARNISHED_AMULET, 1, 2)
	.add(Slayer2026Item.TARNISHED_BRACELET, 1, 2)
	.add(Slayer2026Item.TARNISHED_NECKLACE, 1, 2)
	.add(Slayer2026Item.TARNISHED_2H_SWORD, 1, 1)
	.add(Slayer2026Item.TARNISHED_BATTLEAXE, 1, 1)
	.add(Slayer2026Item.TARNISHED_HALBERD, 1, 1)
	.add(Slayer2026Item.TARNISHED_LONGSWORD, 1, 1);

const VenatorTable = new LootTable({ limit: 131 })
	.every('Bones')
	.tertiary(860, 'Blood shard')
	.add('Coins', [3000, 7000], 19)
	.add('Adamantite ore', [3, 5], 17)
	.add('Fish offcuts', [3, 5], 5)
	.add(Slayer2026Item.STYMPHIKE_FEATHER, [15, 22], 12)
	.add('Mithril ore', [6, 7], 12)
	.add('Hard leather', 1, 6)
	.add('Fine fish offcuts', 2, 3)
	.add('Mort myre fungus', 5, 10)
	.add('Jug of wine', 1, 1)
	.add(Slayer2026Item.GRAPEVINE, 1, 5)
	.add(Slayer2026Item.BLOOD_SAC, [6, 8], 3)
	.add(Slayer2026Item.VENATOR_FANG, [10, 20], 7)
	.add(Slayer2026Item.VENATOR_TOOTH, [15, 30], 7)
	.add(Slayer2026Item.LETVEK, 1, 2)
	.add(Slayer2026Item.ORIKALKUM_GRAVEL, 1, 1)
	.add('Runite ore', 1, 1)
	.add(TarnishedTable, 1, 18)
	.add(GemTable, 1, 1)
	.tertiary(1250, 'Clue scroll (elite)');

function superiorMonster(
	id: number,
	name: string,
	base: LootTable,
	template: (typeof Monsters)['Kurask'],
	data: { hitpoints: number; slayerXP: number; combatLevel: number }
) {
	return setCustomMonster(id, name, superiorTable(base), template, {
		data: { ...template.data, ...data }
	});
}

export const DireGryphon = superiorMonster(
	Slayer2026MonsterID.DIRE_GRYPHON,
	'Dire gryphon',
	GryphonTable,
	Monsters.Kurask,
	{
		hitpoints: 330,
		slayerXP: 1400,
		combatLevel: 210
	}
);

export const ElderAquanite = superiorMonster(
	Slayer2026MonsterID.ELDER_AQUANITE,
	'Elder aquanite',
	AquaniteTable,
	Monsters.SmokeDevil,
	{ hitpoints: 540, slayerXP: 2200, combatLevel: 290 }
);

export const BloodStarvedVenator = superiorMonster(
	Slayer2026MonsterID.BLOOD_STARVED_VENATOR,
	'Blood-starved venator',
	new LootTable().every(VenatorTable).tertiary(108, 'Blood shard'),
	Monsters.AbyssalDemon,
	{ hitpoints: 690, slayerXP: 3600, combatLevel: 380 }
);

export const Gryphon: CustomMonster = {
	isCustom: true,
	id: Slayer2026MonsterID.GRYPHON,
	name: 'Gryphon',
	aliases: ['gryphon', 'gryphons'],
	timeToFinish: Time.Second * 24,
	table: GryphonTable,
	baseMonster: Monsters.Kurask,
	hp: 110,
	customMonsterData: { combatLevel: 95, slayerLevelRequired: 51, slayerXP: 110 },
	levelRequirements: { slayer: 51 },
	difficultyRating: 4,
	qpRequired: 0,
	healAmountNeeded: 40,
	attackStyleToUse: GearStat.AttackSlash,
	attackStylesUsed: [GearStat.AttackCrush],
	superior: DireGryphon,
	itemInBankBoosts: [crushBoosts()],
	canCannon: true,
	cannonMulti: false,
	canBarrage: false,
	respawnTime: Time.Second * 5
};

export const Aquanite: CustomMonster = {
	isCustom: true,
	id: Slayer2026MonsterID.AQUANITE,
	name: 'Aquanite',
	aliases: ['aquanite', 'aquanites'],
	timeToFinish: Time.Second * 40,
	table: AquaniteTable,
	baseMonster: Monsters.SmokeDevil,
	hp: 180,
	customMonsterData: { combatLevel: 145, slayerLevelRequired: 78, slayerXP: 180 },
	levelRequirements: { slayer: 78 },
	difficultyRating: 5,
	qpRequired: 0,
	healAmountNeeded: 80,
	attackStyleToUse: GearStat.AttackRanged,
	attackStylesUsed: [GearStat.AttackMagic],
	superior: ElderAquanite,
	itemInBankBoosts: [
		{
			[itemID('Drygore rapier')]: 12,
			[itemID("Osmumten's fang")]: 8,
			[itemID('Ghrazi rapier')]: 6
		}
	],
	canCannon: false,
	canBarrage: false,
	respawnTime: Time.Second * 5
};

export const Venator: CustomMonster = {
	isCustom: true,
	id: Slayer2026MonsterID.VENATOR,
	name: 'Venator',
	aliases: ['venator', 'venators'],
	timeToFinish: Time.Second * 75,
	table: VenatorTable,
	baseMonster: Monsters.AbyssalDemon,
	hp: 345,
	customMonsterData: {
		combatLevel: 246,
		slayerLevelRequired: 74,
		slayerXP: 405,
		attributes: [MonsterAttribute.Vampyre]
	},
	levelRequirements: { slayer: 74 },
	difficultyRating: 7,
	qpRequired: 0,
	healAmountNeeded: 160,
	attackStyleToUse: GearStat.AttackStab,
	attackStylesUsed: [GearStat.AttackStab, GearStat.AttackRanged],
	superior: BloodStarvedVenator,
	canCannon: false,
	canBarrage: false,
	respawnTime: Time.Second * 8,
	requiredQuests: [QuestID.TheBloodMoonRises],
	itemInBankBoosts: [
		{
			[itemID('Blisterwood flail')]: 10,
			[BloodMoonItem.HALLOWED_FLAIL]: 20,
			[BloodMoonItem.SUNSPEAR]: 25
		}
	],
	effect: ({ gearBank, quantity, loot, rng }) => {
		if (!gearBank.hasEquipped(BloodMoonItem.SUNSPEAR)) return;
		let hearts = 0;
		for (let i = 0; i < quantity; i++) {
			if (rng.roll(2)) hearts++;
		}
		if (hearts === 0) return;
		loot.add(Slayer2026Item.VENATOR_HEART, hearts);
		return { messages: [`Your Sunspear finished off ${hearts}x venators, taking their hearts.`] };
	}
};

const ShellbaneMainTable = new LootTable({ limit: 128 })
	.add('Rune claws', 1, 10)
	.add('Rune scimitar', 1, 8)
	.add('Adamant cannonball', [35, 50], 8)
	.add('Rune cannonball', [20, 30], 6)
	.add('Raw swordfish', 1, 14)
	.add('Sweetcorn', 1, 10)
	.add('Watermelon', 1, 10)
	.add('Raw sea turtle', 1, 4)
	.add('Potato seed', [1, 4], 7)
	.add('Onion seed', [1, 3], 4)
	.add('Cabbage seed', [1, 3], 2)
	.add('Tomato seed', [1, 2], 3)
	.add('Sweetcorn seed', [1, 2], 2)
	.add('Elkhorn frag', 1, 1)
	.add('Pillar frag', 1, 1)
	.add(HerbDropTable, 1, 11)
	.add('Gryphon feather', [35, 50], 11)
	.add('Shark lure', [3, 5], 10)
	.add('Basket', 1, 3)
	.add(GemTable, 1, 1);

export const ShellbaneGryphonTable = new LootTable()
	.every('Big bones')
	.every('Gryphon feather', [7, 10])
	.every(ShellbaneMainTable, 2)
	.tertiary(75, ShellbaneItem.BELLES_FOLLY_TARNISHED)
	.tertiary(200, 'Clue scroll (elite)')
	.tertiary(400, 'Long bone')
	.tertiary(2000, ShellbaneItem.JAR_OF_FEATHERS)
	.tertiary(3000, ShellbaneItem.GULL)
	.tertiary(5013, 'Curved bone');

export const ShellbaneGryphon: CustomMonster = {
	isCustom: true,
	id: Slayer2026MonsterID.SHELLBANE_GRYPHON,
	name: 'Shellbane Gryphon',
	aliases: ['shellbane gryphon', 'shellbane'],
	timeToFinish: Time.Second * 75,
	table: ShellbaneGryphonTable,
	baseMonster: Monsters.Kurask,
	hp: 400,
	customMonsterData: { combatLevel: 235, slayerLevelRequired: 51, slayerXP: 400 },
	levelRequirements: { slayer: 51 },
	slayerOnly: true,
	difficultyRating: 5,
	qpRequired: 0,
	healAmountNeeded: 20 * 10,
	attackStyleToUse: GearStat.AttackSlash,
	attackStylesUsed: [GearStat.AttackSlash, GearStat.AttackRanged],
	notifyDrops: [ShellbaneItem.JAR_OF_FEATHERS, ShellbaneItem.GULL],
	itemInBankBoosts: [crushBoosts()],
	canCannon: false,
	canBarrage: false,
	respawnTime: Time.Second * 12
};
