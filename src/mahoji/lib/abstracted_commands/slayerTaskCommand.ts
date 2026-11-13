import { stringMatches } from '@oldschoolgg/toolkit';
import { EItem, Monsters } from 'oldschooljs';

import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import {
	formatModifier,
	getMortimerState,
	getTaskModifier,
	MORTIMER_ID,
	MORTIMER_MAX_BLOCKS,
	MORTIMER_SKIP_COST,
	mortimerOfferMessage,
	rollMortimerOffers
} from '@/lib/slayer/mortimer.js';
import { makeSlayerActionButtons } from '@/lib/slayer/slayerActionButtons.js';
import { addSlayerBlock, getAllSlayerBlocks, getSlayerBlocks, removeSlayerBlock } from '@/lib/slayer/slayerBlocks.js';
import { slayerTaskReturnButtons } from '@/lib/slayer/slayerButtons.js';
import { slayerMasters } from '@/lib/slayer/slayerMasters.js';
import {
	assignNewSlayerTask,
	calcMaxBlockedTasks,
	getCommonTaskName,
	getUsersCurrentSlayerInfo,
	userCanUseMaster
} from '@/lib/slayer/slayerUtil.js';
import type { AssignableSlayerTask, SlayerMaster } from '@/lib/slayer/types.js';

function getAlternateMonsterList(assignedTask: AssignableSlayerTask | null) {
	if (assignedTask) {
		const altMobs = assignedTask.monsters;
		const alternateMonsters = killableMonsters
			.filter(m => {
				return altMobs.includes(m.id) && m.id !== assignedTask.monster.id;
			})
			.map(m => {
				return m?.name;
			});
		const cname = getCommonTaskName(assignedTask?.monster);
		if (cname !== assignedTask?.monster.name && cname.substr(0, cname.length - 1) !== assignedTask?.monster.name) {
			alternateMonsters.unshift(assignedTask?.monster.name);
		}

		return alternateMonsters.length > 0 ? ` (**Alternate Monsters**: ${alternateMonsters.join(', ')})` : '';
	}
	return '';
}

function slayerButtonsFor(master: SlayerMaster | undefined) {
	const skipCost = master?.id === MORTIMER_ID ? MORTIMER_SKIP_COST : 30;
	return makeSlayerActionButtons(skipCost, master?.blockCost ?? 100);
}

function blockedTaskName(monsterId: number) {
	const monster = Monsters.get(monsterId);
	return monster ? getCommonTaskName(monster) : `Unknown (${monsterId})`;
}

export async function slayerListBlocksCommand(mahojiUser: MUser) {
	const maxBlocks = await calcMaxBlockedTasks(mahojiUser);
	const allBlocks = await getAllSlayerBlocks(mahojiUser.id);

	const lines = [
		`Each Slayer master has their own block list, with up to ${maxBlocks} blocks each. A block only stops that master from assigning the task.`,
		''
	];
	for (const master of slayerMasters) {
		const blocks = allBlocks.get(master.id) ?? [];
		const names = blocks.length > 0 ? blocks.map(blockedTaskName).join(', ') : 'None';
		const masterMax = master.id === MORTIMER_ID ? MORTIMER_MAX_BLOCKS : maxBlocks;
		lines.push(`**${master.name}** (${blocks.length}/${masterMax}, ${master.blockCost} pts per block): ${names}`);
	}
	lines.push('', 'Try: `/slayer manage block` to block your current task.');
	return lines.join('\n');
}

export async function slayerStatusCommand(mahojiUser: MUser) {
	const { currentTask, assignedTask, slayerMaster } = await getUsersCurrentSlayerInfo(mahojiUser.id);
	const { slayer_points: slayerPoints } = mahojiUser.user;
	const slayer_streaks = await mahojiUser.fetchStats();
	const mortimer = await getMortimerState(mahojiUser.id);
	const modifier = currentTask && slayerMaster.id === MORTIMER_ID ? await getTaskModifier(currentTask.id) : null;
	const mortimerInfo =
		(modifier ? `\nTask modifier: **${formatModifier(modifier)}**.` : '') +
		(mortimer.tasksCompleted > 0 ? `\nYou have completed ${mortimer.tasksCompleted} Mortimer tasks.` : '');

	return (
		`${
			currentTask
				? `\nYour current task from ${slayerMaster.name} is to kill **${getCommonTaskName(
						assignedTask.monster
					)}**${getAlternateMonsterList(
						assignedTask
					)}. You have ${currentTask.quantity_remaining.toLocaleString()} kills remaining.`
				: ''
		}` +
		`\nYou have ${slayerPoints.toLocaleString()} slayer points, and have completed ${
			slayer_streaks.slayer_task_streak
		} tasks in a row and ${slayer_streaks.slayer_wildy_task_streak} wilderness tasks in a row.` +
		mortimerInfo
	);
}

export async function slayerNewTaskCommand({
	rng,
	user,
	interaction,
	extraContent,
	slayerMasterOverride,
	saveDefaultSlayerMaster,
	showButtons
}: {
	rng: RNGProvider;
	user: MUser;
	interaction: OSInteraction;
	extraContent?: string;
	slayerMasterOverride?: string | undefined;
	saveDefaultSlayerMaster?: boolean;
	showButtons?: boolean;
}): CommandResponse {
	const { currentTask } = await user.fetchSlayerInfo();
	const { slayer_remember_master: rememberedSlayerMaster } = user.user;

	if (await user.minionIsBusy()) {
		return `Your minion is busy, but you can still manage your block list: \`/slayer manage list_blocks\`${await slayerStatusCommand(
			user
		)}`;
	}

	const mortimerState = await getMortimerState(user.id);
	if (!currentTask && mortimerState.offers && mortimerState.offers.length > 0) {
		return mortimerOfferMessage(mortimerState.offers, "You still need to pick one of Mortimer's tasks.\n\n");
	}

	const has99SlayerCape = user.skillsAsLevels.slayer >= 99 && user.hasEquippedOrInBank(EItem.SLAYER_CAPE);

	// Chooses a default slayer master (excluding Krystilia):
	const proposedDefaultMaster = slayerMasters
		.filter(sm => sm.id !== 8) // Exclude Krystilia
		.sort((a, b) => b.basePoints - a.basePoints)
		.find(sm => userCanUseMaster(user, sm));

	// Contains (if matched) the slayer master requested, falling back on saved default, if they have requirements
	const slayerMaster =
		slayerMasterOverride && has99SlayerCape
			? (slayerMasters.find(m => m.aliases.some(alias => stringMatches(alias, slayerMasterOverride))) ?? null)
			: slayerMasterOverride
				? (slayerMasters
						.filter(m => userCanUseMaster(user, m))
						.find(m => m.aliases.some(alias => stringMatches(alias, slayerMasterOverride))) ?? null)
				: rememberedSlayerMaster
					? (slayerMasters
							.filter(m => userCanUseMaster(user, m))
							.find(m => m.aliases.some(alias => stringMatches(alias, rememberedSlayerMaster))) ??
						proposedDefaultMaster)
					: proposedDefaultMaster;

	// Contains (if matched) the requested Slayer Master regardless of requirements.
	const matchedSlayerMaster = slayerMasterOverride
		? (slayerMasters.find(
				m =>
					stringMatches(m.name, slayerMasterOverride) ||
					m.aliases.some(alias => stringMatches(alias, slayerMasterOverride))
			) ?? null)
		: null;

	// Special handling for Turael skip
	if (currentTask && slayerMasterOverride && slayerMaster && slayerMaster.name === 'Turael') {
		if (currentTask.slayer_master_id === MORTIMER_ID) {
			return "Mortimer's tasks can't be skipped by getting a task from Turael.";
		}
		if (slayerMaster.tasks.find(t => t.monster.id === currentTask.monster_id)) {
			return 'You cannot skip this task because Turael assigns it.';
		}
		const isUsingKrystilia = Boolean(currentTask?.slayer_master_id === 8);
		const taskStreakKey = isUsingKrystilia ? 'slayer_wildy_task_streak' : 'slayer_task_streak';
		const warning = `Really cancel task? This will reset your${
			isUsingKrystilia ? ' wilderness' : ''
		} streak to 0 and give you a new ${slayerMaster.name} task.`;

		await interaction.confirmation(warning);
		await prisma.slayerTask.update({
			where: {
				id: currentTask.id
			},
			data: {
				skipped: true,
				quantity_remaining: 0
			}
		});
		await user.statsUpdate({ [taskStreakKey]: 0 });

		const newSlayerTask = await assignNewSlayerTask({ user, rng }, slayerMaster);
		const commonName = getCommonTaskName(newSlayerTask.assignedTask.monster);
		const returnMessage =
			`Your task has been skipped.\n\n ${slayerMaster.name}` +
			` has assigned you to kill ${newSlayerTask.currentTask.quantity}x ${commonName}${getAlternateMonsterList(
				newSlayerTask.assignedTask
			)}.${newSlayerTask.messages.length > 0 ? `\n\n${newSlayerTask.messages.join('\n')}` : ''}`;

		if (showButtons) {
			return {
				content: `${extraContent ?? ''}\n\n${returnMessage}`,
				ephemeral: true,
				components: await slayerTaskReturnButtons(user, slayerButtonsFor(slayerMaster))
			};
		}
		return `${extraContent ?? ''}\n\n${returnMessage}`;
	}

	let resultMessage = '';
	// Store favorite slayer master if requested:
	if (saveDefaultSlayerMaster && slayerMaster) {
		await user.update({ slayer_remember_master: slayerMaster.name });
		resultMessage = `**Saved ${slayerMaster?.name} as default slayer master.**\n\n`;
	}

	if (currentTask || !slayerMaster) {
		let warningInfo = '';
		if (slayerMasterOverride && !slayerMaster && matchedSlayerMaster) {
			const aRequirements: string[] = [];
			if (matchedSlayerMaster.slayerLvl) aRequirements.push(`Slayer Level: ${matchedSlayerMaster.slayerLvl}`);
			if (matchedSlayerMaster.combatLvl) aRequirements.push(`Combat Level: ${matchedSlayerMaster.combatLvl}`);
			if (matchedSlayerMaster.questPoints) aRequirements.push(`Quest points: ${matchedSlayerMaster.questPoints}`);
			warningInfo = `You do not have the requirements to use ${matchedSlayerMaster.name}.\n\n`;
			if (aRequirements.length > 0) warningInfo += `**Requires**:\n${aRequirements.join('\n')}\n\n`;
		}

		const baseInfo = currentTask
			? await slayerStatusCommand(user)
			: `You have no task at the moment, you can get a task using \`/slayer task master:Turael\`All slayer Masters: ${slayerMasters.map(i => i.name).join(', ')}`;

		resultMessage += `${warningInfo}${baseInfo}`;
		if (currentTask && !warningInfo) {
			if (showButtons) {
				return {
					content: `You already have a slayer task: ${resultMessage}`,
					ephemeral: true,
					components: await slayerTaskReturnButtons(
						user,
						slayerButtonsFor(slayerMasters.find(m => m.id === currentTask.slayer_master_id))
					)
				};
			}
		}
		return resultMessage;
	}

	if (slayerMaster.id === MORTIMER_ID) {
		const offers = await rollMortimerOffers(user, rng);
		if (offers.length === 0) {
			return `${resultMessage}Mortimer doesn't have any tasks he can give you right now.`;
		}
		return mortimerOfferMessage(offers, resultMessage);
	}

	const newSlayerTask = await assignNewSlayerTask({ user, rng }, slayerMaster);

	let commonName = getCommonTaskName(newSlayerTask.assignedTask.monster);
	if (commonName === 'TzHaar') {
		resultMessage += 'Ah... Tzhaar... ';
		commonName +=
			'. You can choose to kill TzTok-Jad with `/activities fight_caves `, or TzKal-Zuk with `/activities inferno action:Start Inferno Trip ` as long as you ' +
			"don't kill any regular TzHaar first.";
	}

	resultMessage += `${slayerMaster.name} has assigned you to kill ${
		newSlayerTask.currentTask.quantity
	}x ${commonName}${getAlternateMonsterList(newSlayerTask.assignedTask)}.${
		newSlayerTask.messages.length > 0 ? `\n\n${newSlayerTask.messages.join('\n')}` : ''
	}`;
	if (showButtons) {
		return {
			content: resultMessage,
			ephemeral: true,
			components: await slayerTaskReturnButtons(user, slayerButtonsFor(slayerMaster))
		};
	}

	return resultMessage;
}

export async function slayerSkipTaskCommand({
	user,
	block,
	newTask,
	interaction,
	rng
}: {
	user: MUser;
	block: boolean;
	newTask: boolean;
	interaction: OSInteraction;
	rng: RNGProvider;
}): CommandResponse {
	const { currentTask } = await user.fetchSlayerInfo();
	const maxBlocks = await calcMaxBlockedTasks(user);
	if (await user.minionIsBusy()) {
		return 'You cannot change your task while your minion is busy.';
	}
	if (!currentTask) {
		if (newTask) {
			return slayerNewTaskCommand({
				user,
				interaction,
				showButtons: true,
				rng
			});
		}
		return "You don't have an active task!";
	}

	const taskMaster = slayerMasters.find(m => m.id === currentTask.slayer_master_id);
	if (block && !taskMaster) {
		return "You can't block this task.";
	}
	const masterMax = taskMaster?.id === MORTIMER_ID ? MORTIMER_MAX_BLOCKS : maxBlocks;
	if (block && taskMaster) {
		const masterBlocks = await getSlayerBlocks(user.id, taskMaster.id);
		if (masterBlocks.length >= masterMax) {
			return `You cannot have more than ${masterMax} blocks with ${taskMaster.name}!\n\nUse:\n\`/slayer rewards unblock\`\n to remove a blocked task.\n\`/slayer manage command:list_blocks\` for your block lists.`;
		}
	}
	const slayerPoints = user.user.slayer_points;
	const skipCost = taskMaster?.id === MORTIMER_ID ? MORTIMER_SKIP_COST : 30;
	const cost = block && taskMaster ? taskMaster.blockCost : skipCost;
	if (slayerPoints < cost) {
		return `You need ${cost} points to ${block ? 'block' : 'cancel'}, you only have: ${slayerPoints.toLocaleString()}.`;
	}
	try {
		const spent = await prisma.$queryRaw<{ points: number }[]>`
			UPDATE users SET "slayer.points" = "slayer.points" - ${cost}
			WHERE id = ${user.id} AND "slayer.points" >= ${cost}
			RETURNING "slayer.points" AS points
		`;
		if (spent.length === 0) {
			await user.sync();
			return `You need ${cost} points to ${block ? 'block' : 'cancel'}, you only have: ${user.user.slayer_points.toLocaleString()}.`;
		}
		const claimed = await prisma.slayerTask.updateMany({
			where: { id: currentTask.id, skipped: false, quantity_remaining: { gt: 0 } },
			data: { skipped: true, quantity_remaining: 0 }
		});
		if (claimed.count === 0) {
			await prisma.$executeRaw`UPDATE users SET "slayer.points" = "slayer.points" + ${cost} WHERE id = ${user.id}`;
			await user.sync();
			return 'Your task has already changed.';
		}
		if (block && taskMaster) {
			await addSlayerBlock(user.id, taskMaster.id, currentTask.monster_id);
		}
		await user.sync();
		const resultMessage = `Your task has been ${block && taskMaster ? `blocked for ${taskMaster.name}` : 'skipped'}. You now have ${spent[0].points.toLocaleString()} slayer points.`;

		if (newTask) {
			return slayerNewTaskCommand({
				user,
				interaction,
				extraContent: resultMessage,
				showButtons: true,
				rng
			});
		}
		return resultMessage;
	} catch (e) {
		Logging.logError(e as Error, {
			user_id: user.id.toString(),
			command: 'slayerSkipTaskCommand',
			current_task_id: currentTask.id.toString(),
			current_task: currentTask.monster_id.toString()
		});
		return 'An error occurred while performing this action. Please try again, or contact #help-and-support if the issue persists.';
	}
}

export async function slayerUnblockCommand(mahojiUser: MUser, assignment: string) {
	const allBlocks = await getAllSlayerBlocks(mahojiUser.id);
	const entries = [...allBlocks.entries()].flatMap(([masterId, monsterIds]) =>
		monsterIds.map(monsterId => ({ masterId, monsterId }))
	);
	if (entries.length === 0) {
		return "You don't currently have any tasks blocked.";
	}

	const direct = /^(\d+):(\d+)$/.exec(assignment.trim());
	const matches = direct
		? entries.filter(e => e.masterId === Number(direct[1]) && e.monsterId === Number(direct[2]))
		: entries.filter(e => {
				const monster = Monsters.get(e.monsterId);
				if (!monster) return false;
				return (
					stringMatches(assignment, getCommonTaskName(monster)) ||
					stringMatches(assignment, monster.name) ||
					monster.aliases.some(alias => stringMatches(assignment, alias))
				);
			});

	if (matches.length === 0) {
		return `You don't have **${assignment}** blocked.`;
	}
	if (matches.length > 1) {
		const masters = matches.map(e => slayerMasters.find(m => m.id === e.masterId)?.name ?? e.masterId).join(', ');
		return `You have that task blocked with more than one master (${masters}). Pick the one to unblock from the list.`;
	}

	const [match] = matches;
	const masterName = slayerMasters.find(m => m.id === match.masterId)?.name ?? 'that master';
	try {
		await removeSlayerBlock(mahojiUser.id, match.masterId, match.monsterId);
		return `**${blockedTaskName(match.monsterId)}** has been unblocked for ${masterName}.`;
	} catch (e) {
		Logging.logError(e as Error, {
			user_id: mahojiUser.id.toString(),
			command: 'slayerUnblockCommand',
			assignment
		});
		return 'An error occurred while trying to remove task. Please try again, or ask #help-and-support if the issue persists.';
	}
}

export async function slayerBlockedTaskChoices(userId: string, value: string) {
	const allBlocks = await getAllSlayerBlocks(userId);
	const choices = [...allBlocks.entries()].flatMap(([masterId, monsterIds]) => {
		const masterName = slayerMasters.find(m => m.id === masterId)?.name ?? String(masterId);
		return monsterIds.map(monsterId => ({
			name: `${blockedTaskName(monsterId)} (${masterName})`,
			value: `${masterId}:${monsterId}`
		}));
	});
	if (choices.length === 0) return [{ name: "You don't have any tasks blocked", value: '' }];
	return choices.filter(c => (!value ? true : c.name.toLowerCase().includes(value.toLowerCase())));
}
