export interface DailyTriviaQuestion {
	question: string;
	/** Accepted correct answers (the first one is also in `choices`). */
	answers: string[];
	choices: string[];
}

/** Moderate OSRS knowledge: a regular player should often know these. */
export const DAILY_EASY_TRIVIA: DailyTriviaQuestion[] = [
	{
		question: 'How many waves are there in the Fight Caves?',
		answers: ['63'],
		choices: ['45', '63', '69', '100']
	},
	{
		question: 'Which skill is used to catch a shark?',
		answers: ['Fishing'],
		choices: ['Cooking', 'Hunter', 'Fishing', 'Slayer']
	},
	{
		question: 'Where is the Barrows minigame?',
		answers: ['Morytania'],
		choices: ['Kandarin', 'Morytania', 'Asgarnia', 'Karamja']
	},
	{
		question: 'Which herb is the main ingredient in a Prayer potion?',
		answers: ['Ranarr', 'Ranarr weed'],
		choices: ['Guam', 'Ranarr', 'Irit', 'Kwuarm']
	},
	{
		question: 'What combat style does a crossbow use?',
		answers: ['Ranged'],
		choices: ['Magic', 'Ranged', 'Strength', 'Defence']
	},
	{
		question: 'Which monster drops the Dragon warhammer?',
		answers: ['Lizardman shaman', 'Lizardman shamans'],
		choices: ['Lizardman shaman', 'Zulrah', 'Cerberus', 'Vorkath']
	},
	{
		question: 'What is the highest regular combat level?',
		answers: ['126'],
		choices: ['99', '120', '126', '138']
	},
	{
		question: 'Which prayer is unlocked at level 70?',
		answers: ['Piety'],
		choices: ['Chivalry', 'Piety', 'Rigour', 'Protect from Melee']
	},
	{
		question: 'The Cooking Guild is next to which city?',
		answers: ['Varrock'],
		choices: ['Varrock', 'Falador', 'Ardougne', 'Catherby']
	},
	{
		question: 'How do you get a Fire cape?',
		answers: ['Defeat TzTok-Jad', 'Defeat Jad'],
		choices: ['99 Firemaking', 'Defeat TzTok-Jad', '99 Strength', 'Complete Dragon Slayer']
	},
	{
		question: 'What Fishing level is required to catch sharks?',
		answers: ['76'],
		choices: ['62', '76', '80', '82']
	},
	{
		question: 'Which metal comes after Mithril when smithing?',
		answers: ['Adamant', 'Adamantite'],
		choices: ['Steel', 'Adamant', 'Rune', 'Gold']
	},
	{
		question: 'Wintertodt primarily trains which skill?',
		answers: ['Firemaking'],
		choices: ['Firemaking', 'Woodcutting', 'Fishing', 'Hunter']
	},
	{
		question: 'How many inventory spaces does a player have?',
		answers: ['28'],
		choices: ['24', '27', '28', '30']
	},
	{
		question: 'Which skill turns ores into bars?',
		answers: ['Smithing'],
		choices: ['Mining', 'Smithing', 'Crafting', 'Firemaking']
	}
];

/** Harder OSRS knowledge: levels, quest rewards, drop details, later-game content. */
export const DAILY_MEDIUM_TRIVIA: DailyTriviaQuestion[] = [
	{
		question: 'What Slayer level is required to kill Abyssal demons?',
		answers: ['85'],
		choices: ['75', '80', '85', '90']
	},
	{
		question: 'What is the drop rate of an Abyssal whip from Abyssal demons?',
		answers: ['1/512'],
		choices: ['1/256', '1/512', '1/1024', '1/128']
	},
	{
		question: 'Which quest unlocks Ancient Magicks?',
		answers: ['Desert Treasure', 'Desert Treasure I'],
		choices: ['Desert Treasure', 'Recipe for Disaster', 'Lunar Diplomacy', 'Dream Mentor']
	},
	{
		question: 'Which herb is used to make a Super restore potion?',
		answers: ['Snapdragon'],
		choices: ['Ranarr', 'Snapdragon', 'Toadflax', 'Torstol']
	},
	{
		question: "Who is the Theatre of Blood's final boss?",
		answers: ['Verzik Vitur', 'Verzik'],
		choices: ['Xarpus', 'Verzik Vitur', 'Maiden of Sugadinti', 'Nex']
	},
	{
		question: 'What Ranged level is required to wield a Twisted bow?',
		answers: ['75'],
		choices: ['70', '75', '80', '85']
	},
	{
		question: "Zulrah's magic (blue) form is weak to which style?",
		answers: ['Ranged'],
		choices: ['Magic', 'Ranged', 'Melee', 'Stab']
	},
	{
		question: 'What Hunter level is required to catch black chinchompas?',
		answers: ['73'],
		choices: ['63', '73', '80', '53']
	},
	{
		question: 'Which diary rewards Elite void knight equipment?',
		answers: ['Western Provinces', 'Western Provinces Diary'],
		choices: ['Karamja', 'Western Provinces', 'Falador', 'Kandarin']
	},
	{
		question: 'What Magic level is required to cast Ice Barrage?',
		answers: ['94'],
		choices: ['82', '88', '94', '96']
	},
	{
		question: 'Which God Wars general is in the south-west room?',
		answers: ["K'ril Tsutsaroth", 'Kril Tsutsaroth', 'Zamorak'],
		choices: ["Kree'arra", 'General Graardor', "K'ril Tsutsaroth", 'Commander Zilyana']
	},
	{
		question: 'What Mining level is required to mine amethyst?',
		answers: ['92'],
		choices: ['85', '90', '92', '95']
	},
	{
		question: 'A Vorkath head is used to make which item?',
		answers: ["Ava's assembler", 'Assembler'],
		choices: ["Ava's assembler", 'Dragon hunter lance', "Ava's accumulator", 'Dragonfire ward']
	},
	{
		question: 'How many waves are there in the Inferno?',
		answers: ['69'],
		choices: ['63', '66', '69', '72']
	},
	{
		question: 'What Farming level is required to plant a magic sapling?',
		answers: ['75'],
		choices: ['68', '75', '85', '90']
	},
	{
		question: 'What Slayer level is required to kill Alchemical Hydra?',
		answers: ['95'],
		choices: ['87', '91', '95', '99']
	},
	{
		question: 'How many Marks of grace does a full Graceful set cost?',
		answers: ['260'],
		choices: ['200', '250', '260', '320']
	},
	{
		question: 'A hydra claw is used to make which weapon?',
		answers: ['Dragon hunter lance'],
		choices: ['Dragon hunter lance', 'Dragon hunter crossbow', 'Bonecrusher', 'Brimstone ring']
	}
];

export function pickDailyTrivia(rng: RNGProvider, difficulty: 'easy' | 'medium', count: number): DailyTriviaQuestion[] {
	const pool = difficulty === 'medium' ? DAILY_MEDIUM_TRIVIA : DAILY_EASY_TRIVIA;
	return rng
		.shuffle([...pool])
		.slice(0, Math.min(count, pool.length))
		.map(question => ({
			question: question.question,
			answers: [...question.answers],
			choices: rng.shuffle([...question.choices])
		}));
}

export function isDailyTriviaAnswerCorrect(question: DailyTriviaQuestion, answer: string | undefined): boolean {
	if (!answer) return false;
	const value = answer.trim();
	return question.answers.some(accepted => accepted.toLowerCase() === value.toLowerCase());
}
