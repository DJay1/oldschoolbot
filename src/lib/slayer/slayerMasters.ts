import { MonsterSlayerMaster } from 'oldschooljs';

import { MORTIMER_BLOCK_COST } from '@/lib/slayer/mortimer.js';
import { chaeldarTasks } from '@/lib/slayer/tasks/chaeldarTasks.js';
import { duradelTasks } from '@/lib/slayer/tasks/duradelTasks.js';
import { konarTasks } from '@/lib/slayer/tasks/konarTasks.js';
import { krystiliaTasks } from '@/lib/slayer/tasks/krystiliaTasks.js';
import { mazchnaTasks } from '@/lib/slayer/tasks/mazchnaTasks.js';
import { mortimerTasks } from '@/lib/slayer/tasks/mortimerTasks.js';
import { nieveTasks } from '@/lib/slayer/tasks/nieveTasks.js';
import { turaelTasks } from '@/lib/slayer/tasks/turaelTasks.js';
import { vannakaTasks } from '@/lib/slayer/tasks/vannakaTasks.js';
import type { SlayerMaster } from '@/lib/slayer/types.js';

export const slayerMasters: SlayerMaster[] = [
	{
		id: 1,
		name: 'Turael',
		aliases: ['turael', 'tu', 'tura'],
		tasks: turaelTasks,
		basePoints: 0,
		blockCost: 40,
		osjsEnum: MonsterSlayerMaster.Turael
	},
	{
		id: 2,
		name: 'Mazchna',
		aliases: ['mazchna', 'ma', 'maz'],
		tasks: mazchnaTasks,
		basePoints: 6,
		blockCost: 50,
		combatLvl: 20,
		questPoints: 1,
		osjsEnum: MonsterSlayerMaster.Mazchna
	},
	{
		id: 3,
		name: 'Vannaka',
		aliases: ['vannaka', 'van', 'vanna'],
		tasks: vannakaTasks,
		basePoints: 8,
		blockCost: 60,
		combatLvl: 40,
		osjsEnum: MonsterSlayerMaster.Vannaka
	},
	{
		id: 4,
		name: 'Chaeldar',
		aliases: ['chaeldar', 'cha', 'chael'],
		tasks: chaeldarTasks,
		basePoints: 10,
		blockCost: 70,
		combatLvl: 70,
		questPoints: 3,
		osjsEnum: MonsterSlayerMaster.Chaeldar
	},
	{
		id: 5,
		name: 'Konar quo Maten',
		aliases: ['konar quo maten', 'konar', 'kon', 'kona'],
		tasks: konarTasks,
		bossTasks: true,
		basePoints: 18,
		blockCost: 80,
		combatLvl: 75,
		osjsEnum: MonsterSlayerMaster.Konar
	},
	{
		id: 6,
		name: 'Nieve',
		aliases: ['nieve', 'steve', 'nie', 'niev'],
		tasks: nieveTasks,
		bossTasks: true,
		basePoints: 15,
		blockCost: 90,
		combatLvl: 85,
		osjsEnum: MonsterSlayerMaster.Nieve
	},
	{
		id: 7,
		name: 'Duradel',
		aliases: ['duradel', 'dur', 'dura', 'duradaddy'],
		tasks: duradelTasks,
		bossTasks: true,
		basePoints: 15,
		blockCost: 100,
		combatLvl: 100,
		slayerLvl: 50,
		osjsEnum: MonsterSlayerMaster.Duradel
	},
	{
		id: 8,
		name: 'Krystilia',
		aliases: ['krystilia', 'wildy slayer', 'wilderness slayer'],
		tasks: krystiliaTasks,
		basePoints: 25,
		blockCost: 100,
		osjsEnum: MonsterSlayerMaster.Krystilia
	},
	{
		id: 9,
		name: 'Mortimer',
		aliases: ['mortimer', 'mort'],
		tasks: mortimerTasks,
		basePoints: 0,
		blockCost: MORTIMER_BLOCK_COST,
		combatLvl: 100,
		slayerLvl: 70,
		osjsEnum: MonsterSlayerMaster.Duradel
	}
];
