import type { CustomMonster } from '@/lib/bso/monsters/CustomMonster.js';
import { Aquanite, Gryphon, Venator } from '@/lib/bso/monsters/slayer2026Monsters.js';

import { Monsters } from 'oldschooljs';

import { QuestID } from '@/lib/minions/data/quests.js';
import { chaeldarTasks } from '@/lib/slayer/tasks/chaeldarTasks.js';
import { duradelTasks } from '@/lib/slayer/tasks/duradelTasks.js';
import { konarTasks } from '@/lib/slayer/tasks/konarTasks.js';
import { mazchnaTasks } from '@/lib/slayer/tasks/mazchnaTasks.js';
import { nieveTasks } from '@/lib/slayer/tasks/nieveTasks.js';
import { turaelTasks } from '@/lib/slayer/tasks/turaelTasks.js';
import { vannakaTasks } from '@/lib/slayer/tasks/vannakaTasks.js';
import type { AssignableSlayerTask } from '@/lib/slayer/types.js';

export type MortimerModifierKind = 'points' | 'quantity' | 'clue' | 'superior' | 'xp';

type Range = readonly [number, number];

export interface MortimerTaskSpec {
	monsterId: number;
	monster?: CustomMonster;
	requiredQuests?: QuestID[];
	amount: Range;
	extendedAmount?: Range;
	weight: number;
	slayerLevel: number;
	combatLevel?: number;
	modifiers: {
		points: Range;
		quantity: Range;
		clue: Range | null;
		xp: Range;
		superior: Range;
	};
}

const low = { points: [5, 15], quantity: [-15, 30], xp: [25, 100], superior: [50, 100] } as const;
const strong = { quantity: [30, 80], points: [15, 30], xp: [35, 75], superior: [200, 300] } as const;

export const mortimerTaskSpecs: MortimerTaskSpec[] = [
	{
		monsterId: Monsters.CrawlingHand.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 5,
		modifiers: { ...low, clue: null }
	},
	{
		monsterId: Monsters.CaveCrawler.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 10,
		combatLevel: 10,
		modifiers: { ...low, clue: null }
	},
	{
		monsterId: Monsters.Banshee.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 15,
		combatLevel: 20,
		modifiers: { ...low, clue: [75, 150] }
	},
	{
		monsterId: Monsters.Rockslug.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 20,
		combatLevel: 20,
		modifiers: { ...low, clue: null }
	},
	{
		monsterId: Monsters.Cockatrice.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 25,
		combatLevel: 25,
		modifiers: { ...low, clue: [75, 150] }
	},
	{
		monsterId: Monsters.Pyrefiend.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 30,
		combatLevel: 25,
		modifiers: { ...low, clue: [75, 150] }
	},
	{
		monsterId: Monsters.Basilisk.id,
		amount: [40, 60],
		extendedAmount: [200, 250],
		weight: 10,
		slayerLevel: 40,
		combatLevel: 40,
		modifiers: { quantity: [50, 100], points: [25, 40], clue: [75, 150], xp: [35, 75], superior: [200, 300] }
	},
	{
		monsterId: Monsters.InfernalMage.id,
		amount: [35, 50],
		weight: 10,
		slayerLevel: 45,
		combatLevel: 40,
		modifiers: { ...low, clue: null }
	},
	{
		monsterId: Monsters.Bloodveld.id,
		amount: [120, 180],
		extendedAmount: [200, 250],
		weight: 8,
		slayerLevel: 50,
		combatLevel: 50,
		modifiers: { quantity: [50, 100], points: [10, 15], clue: [35, 75], xp: [5, 15], superior: [100, 150] }
	},
	{
		monsterId: Gryphon.id,
		monster: Gryphon,
		amount: [80, 120],
		extendedAmount: [160, 200],
		weight: 10,
		slayerLevel: 51,
		modifiers: { quantity: [50, 100], points: [10, 25], clue: [75, 150], xp: [20, 50], superior: [100, 150] }
	},
	{
		monsterId: Monsters.Jelly.id,
		amount: [80, 120],
		weight: 10,
		slayerLevel: 52,
		combatLevel: 57,
		modifiers: { quantity: [50, 100], points: [10, 15], clue: [35, 75], xp: [10, 25], superior: [100, 150] }
	},
	{
		monsterId: Monsters.JuvenileCustodianStalker.id,
		amount: [80, 120],
		extendedAmount: [200, 250],
		weight: 8,
		slayerLevel: 54,
		modifiers: { quantity: [50, 100], points: [10, 15], clue: null, xp: [10, 25], superior: [100, 150] }
	},
	{
		monsterId: Monsters.Turoth.id,
		amount: [80, 120],
		weight: 10,
		slayerLevel: 55,
		combatLevel: 60,
		modifiers: { ...strong, clue: [75, 150] }
	},
	{
		monsterId: Monsters.WarpedTerrorbird.id,
		amount: [80, 120],
		weight: 10,
		slayerLevel: 56,
		modifiers: { ...strong, quantity: [50, 100], clue: [75, 150] }
	},
	{
		monsterId: Monsters.CaveHorror.id,
		amount: [80, 120],
		extendedAmount: [200, 250],
		weight: 10,
		slayerLevel: 58,
		combatLevel: 85,
		modifiers: { ...strong, clue: [75, 150] }
	},
	{
		monsterId: Monsters.AberrantSpectre.id,
		amount: [80, 120],
		extendedAmount: [200, 250],
		weight: 10,
		slayerLevel: 60,
		combatLevel: 65,
		modifiers: { ...strong, clue: [75, 150] }
	},
	{
		monsterId: Monsters.Wyrm.id,
		amount: [80, 120],
		extendedAmount: [200, 250],
		weight: 10,
		slayerLevel: 62,
		modifiers: { quantity: [50, 100], points: [25, 40], clue: [75, 150], xp: [35, 75], superior: [200, 300] }
	},
	{
		monsterId: Monsters.DustDevil.id,
		amount: [120, 180],
		extendedAmount: [200, 250],
		weight: 8,
		slayerLevel: 65,
		combatLevel: 70,
		modifiers: { quantity: [50, 150], points: [10, 15], clue: null, xp: [10, 20], superior: [100, 150] }
	},
	{
		monsterId: Monsters.Kurask.id,
		amount: [40, 60],
		weight: 10,
		slayerLevel: 70,
		combatLevel: 65,
		modifiers: { ...strong, points: [25, 40], clue: [75, 150] }
	},
	{
		monsterId: Venator.id,
		monster: Venator,
		requiredQuests: [QuestID.TheBloodMoonRises],
		amount: [120, 180],
		weight: 10,
		slayerLevel: 74,
		combatLevel: 60,
		modifiers: { quantity: [50, 100], points: [10, 25], clue: [75, 150], xp: [35, 75], superior: [200, 300] }
	},
	{
		monsterId: Monsters.Gargoyle.id,
		amount: [120, 180],
		extendedAmount: [200, 250],
		weight: 10,
		slayerLevel: 75,
		combatLevel: 80,
		modifiers: { ...strong, quantity: [50, 100], clue: [75, 150] }
	},
	{
		monsterId: Aquanite.id,
		monster: Aquanite,
		amount: [40, 60],
		extendedAmount: [150, 200],
		weight: 10,
		slayerLevel: 78,
		modifiers: { quantity: [50, 100], points: [25, 40], clue: [75, 150], xp: [35, 75], superior: [200, 300] }
	},
	{
		monsterId: Monsters.Nechryael.id,
		amount: [150, 200],
		extendedAmount: [200, 250],
		weight: 8,
		slayerLevel: 80,
		combatLevel: 85,
		modifiers: { quantity: [50, 100], points: [10, 20], clue: [35, 75], xp: [15, 30], superior: [70, 120] }
	},
	{
		monsterId: Monsters.Drake.id,
		amount: [40, 60],
		weight: 10,
		slayerLevel: 84,
		modifiers: { quantity: [30, 80], points: [25, 40], clue: [75, 150], xp: [25, 75], superior: [75, 150] }
	},
	{
		monsterId: Monsters.AbyssalDemon.id,
		amount: [120, 180],
		extendedAmount: [200, 250],
		weight: 8,
		slayerLevel: 85,
		combatLevel: 85,
		modifiers: { quantity: [50, 100], points: [10, 25], clue: [35, 75], xp: [10, 25], superior: [30, 60] }
	},
	{
		monsterId: Monsters.DarkBeast.id,
		amount: [40, 60],
		extendedAmount: [110, 135],
		weight: 10,
		slayerLevel: 90,
		combatLevel: 90,
		modifiers: { ...strong, points: [10, 25], clue: [75, 150] }
	},
	{
		monsterId: Monsters.Araxyte.id,
		amount: [120, 180],
		extendedAmount: [200, 250],
		weight: 8,
		slayerLevel: 92,
		modifiers: { quantity: [50, 100], points: [10, 20], clue: [35, 75], xp: [5, 15], superior: [10, 25] }
	},
	{
		monsterId: Monsters.SmokeDevil.id,
		amount: [80, 120],
		weight: 8,
		slayerLevel: 93,
		combatLevel: 85,
		modifiers: { quantity: [50, 100], points: [10, 20], clue: [35, 75], xp: [5, 15], superior: [10, 25] }
	},
	{
		monsterId: Monsters.Hydra.id,
		amount: [150, 200],
		weight: 10,
		slayerLevel: 95,
		modifiers: { quantity: [50, 100], points: [15, 30], clue: [75, 150], xp: [10, 30], superior: [75, 150] }
	}
];

const otherMasterTasks = [
	...duradelTasks,
	...nieveTasks,
	...konarTasks,
	...chaeldarTasks,
	...vannakaTasks,
	...mazchnaTasks,
	...turaelTasks
];

function buildTask(spec: MortimerTaskSpec): AssignableSlayerTask {
	const base = otherMasterTasks.find(t => t.monster.id === spec.monsterId);
	const monster = spec.monster ?? base?.monster ?? Monsters.get(spec.monsterId);
	if (!monster) throw new Error(`Mortimer task monster ${spec.monsterId} does not exist`);
	return {
		monster,
		amount: [spec.amount[0], spec.amount[1]],
		weight: spec.weight,
		monsters: base?.monsters ?? [spec.monsterId],
		slayerLevel: spec.slayerLevel,
		combatLevel: spec.combatLevel,
		questPoints: base?.questPoints,
		requiredQuests: spec.requiredQuests ?? base?.requiredQuests,
		levelRequirements: base?.levelRequirements,
		extendedAmount: spec.extendedAmount ? [spec.extendedAmount[0], spec.extendedAmount[1]] : undefined,
		extendedUnlockId: base?.extendedUnlockId,
		unlocked: true
	};
}

export const mortimerTasks: AssignableSlayerTask[] = mortimerTaskSpecs.map(buildTask);

export function mortimerSpecFor(monsterId: number): MortimerTaskSpec | undefined {
	return mortimerTaskSpecs.find(spec => spec.monsterId === monsterId);
}
