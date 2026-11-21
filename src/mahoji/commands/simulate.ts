import { formatDuration, PerkTier } from '@oldschoolgg/toolkit';
import { MathRNG, randInt, roll } from 'node-rng';
import { averageBank, Bank, ChambersOfXeric, toKMB } from 'oldschooljs';

import { simulateOpenCooldownLeft } from '@/lib/bsc/simulateOpenCooldown.js';
import { ColosseumWaveBank, startColosseumRun } from '@/lib/colosseum.js';
import pets from '@/lib/data/pets.js';
import {
	autocompleteSimulatableOpenables,
	findSimulatableOpenable,
	formatSimulateOpenCaption,
	SIMULATE_OPEN_MAX,
	simulateOpenableLoot
} from '@/lib/simulation/simulateOpenable.js';
import { assert } from '@/lib/util/logError.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { validateQuantity } from '@/lib/util/validateQuantity.js';

async function determineCoxLimit(user: MUser) {
	const perkTier = await user.fetchPerkTier();

	if (perkTier >= PerkTier.Three) {
		return 2000;
	}

	if (perkTier === PerkTier.Two) {
		return 1000;
	}

	if (perkTier === PerkTier.One) {
		return 100;
	}

	return 10;
}

function simulateColosseumRuns(samples = 100) {
	const totalSimulations = samples;
	let totalAttempts = 0;
	let totalDeaths = 0;
	const totalLoot = new Bank();
	const finishAttemptAmounts = [];
	let totalDuration = 0;

	for (let i = 0; i < totalSimulations; i++) {
		let attempts = 0;
		let deaths = 0;
		let done = false;
		const kcBank = new ColosseumWaveBank();
		const runLoot = new Bank();

		while (!done) {
			attempts++;
			const result = startColosseumRun({
				kcBank,
				hasScythe: false,
				hasTBow: false,
				hasVenBow: true,
				hasBF: false,
				hasClaws: true,
				hasSGS: true,
				hasTorture: false,
				scytheCharges: 300,
				venatorBowCharges: 50,
				bloodFuryCharges: 0,
				voidCharges: 35,
				hasVoidStaff: true,
				hasHFB: true,
				hasSungodAxe: true,
				hasGora: true,
				hasBHook: true,
				hasBulwark: true,
				rng: MathRNG
			});
			totalDuration += result.realDuration;
			kcBank.add(result.addedWaveKCBank);
			if (result.diedAt === null) {
				if (result.loot) runLoot.add(result.loot);
				done = true;
			} else {
				deaths++;
			}
		}
		assert(kcBank.amount(12) > 0);
		finishAttemptAmounts.push(attempts);
		totalAttempts += attempts;
		totalDeaths += deaths;
		totalLoot.add(runLoot);
	}

	const averageAttempts = totalAttempts / totalSimulations;
	const averageDeaths = totalDeaths / totalSimulations;

	finishAttemptAmounts.sort((a, b) => a - b);

	const result = `Results from the simulation of ${totalSimulations}x people completing the Colosseum:
**Average duration to beat wave 12 for first time:** ${formatDuration(totalDuration / totalSimulations)}
**Average deaths before beating wave 12:** ${averageDeaths}
**Average loot:** ${averageBank(totalLoot, totalSimulations)}
**Fastest completion trips:** ${finishAttemptAmounts[0]}
**Mean completion trips:** ${finishAttemptAmounts[Math.floor(finishAttemptAmounts.length / 2)]}
**Average trips to beat wave 12:** ${averageAttempts}.
**Longest completion trips:** ${finishAttemptAmounts[finishAttemptAmounts.length - 1]}`;
	return result;
}

async function coxCommand(user: MUser, quantity: number, cm = false, points = 25_000, teamSize = 4): CommandResponse {
	const limit = await determineCoxLimit(user);
	if (quantity > limit) {
		return `The quantity provided is over your limit of ${limit}.`;
	}

	const team = [
		{
			id: user.id,
			personalPoints: points
		}
	];
	while (team.length < Math.min(100, teamSize)) {
		team.push({ id: `${randInt(1, 10_000_000)}`, personalPoints: points });
	}

	const loot = new Bank();
	for (let i = 0; i < quantity; i++) {
		const singleRaidLoot = ChambersOfXeric.complete({
			team,
			challengeMode: cm,
			timeToComplete: 1
		});

		for (const lootBank of Object.values(singleRaidLoot)) {
			loot.add(lootBank);
		}
	}
	const image = await makeBankImage({
		bank: loot,
		title: `Loot from ${quantity} ${cm ? 'challenge mode ' : ''}raids`
	});

	return {
		content: `Personal Loot from ${quantity}x raids, with ${team.length} people, each with ${toKMB(
			points
		)} points.`,
		files: [image]
	};
}

export const simulateCommand = defineCommand({
	name: 'simulate',
	description: 'Simulate various OSRS related things.',
	attributes: {
		examples: ['/simulate cox quantity:1']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'cox',
			description: 'Simulate Chambers of Xeric.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The amount of raids to simulate.',
					min_value: 1,
					max_value: 1000,
					required: true
				},
				{
					type: 'Integer',
					name: 'points',
					description: 'How many points to have (default 25k).',
					min_value: 1,
					max_value: 1_000_000,
					required: false
				},
				{
					type: 'Integer',
					name: 'team_size',
					description: 'The size of your team (default 4).',
					min_value: 1,
					max_value: 15,
					required: false
				},
				{
					type: 'Boolean',
					name: 'challenge_mode',
					description: 'Challenge mode raids? (default false)',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'petroll',
			description: 'Simulate rolls at every pet at once.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The amount of rolls.',
					min_value: 1,
					max_value: 100,
					required: true
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'colosseum',
			description: 'Simulate colosseum.'
		},
		{
			type: 'Subcommand',
			name: 'open',
			description: 'Simulate opening a box or other openable. Nothing is given or taken.',
			options: [
				{
					type: 'String',
					name: 'name',
					description: 'The box or openable to simulate.',
					required: true,
					autocomplete: async ({ value }: StringAutoComplete) => autocompleteSimulatableOpenables(value ?? '')
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'How many to simulate opening.',
					required: true,
					min_value: 1,
					max_value: SIMULATE_OPEN_MAX
				}
			]
		}
	],
	run: async ({ interaction, options, user, rng }) => {
		await interaction.defer();
		if (options.open) {
			const quantityCheck = validateQuantity(options.open.quantity, {
				min: 1,
				max: SIMULATE_OPEN_MAX,
				label: 'Quantity'
			});
			if (!quantityCheck.ok) return quantityCheck.error;
			const openable = findSimulatableOpenable(options.open.name);
			if (!openable) {
				return "That's not a box you can simulate right now.";
			}
			const wait = simulateOpenCooldownLeft(user.id, Date.now());
			if (wait > 0) {
				return `Please wait ${Math.ceil(wait / 1000)}s before simulating another box.`;
			}
			let totalLeaguesPoints = 0;
			try {
				totalLeaguesPoints = (await Cache.getRoboChimpUser(user.id)).leagues_points_total ?? 0;
			} catch {
				totalLeaguesPoints = 0;
			}
			const result = await simulateOpenableLoot({
				openable,
				quantity: quantityCheck.value,
				user,
				rng,
				totalLeaguesPoints
			});
			const caption = formatSimulateOpenCaption(openable.name, quantityCheck.value);
			const extra = result.message ? `\n${result.message}` : '';
			let content = `${caption}${extra}`;
			if (content.length > 1850) content = caption;
			if (result.bank.length === 0) {
				return `${content}\nNo items came out of the simulation.`;
			}
			const image = await makeBankImage({
				bank: result.bank,
				title: `Simulated loot from ${quantityCheck.value.toLocaleString()}x ${openable.name}`
			});
			return { content, files: [image] };
		}
		if (options.colosseum) {
			return simulateColosseumRuns();
		}
		if (options.cox) {
			return coxCommand(
				user,
				options.cox.quantity,
				options.cox.challenge_mode,
				options.cox.points,
				options.cox.team_size
			);
		}
		if (options.petroll) {
			const received = [];

			for (let i = 0; i < options.petroll.quantity; i++) {
				for (const pet of pets) {
					if (roll(pet.chance)) received.push(pet.emoji);
				}
			}

			if (received.length === 0) return "You didn't get any pets!";
			return received.join(' ');
		}
		return 'Invalid command.';
	}
});
