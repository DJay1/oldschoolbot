import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { Monsters } from 'oldschooljs';

import { BitField } from '@/lib/constants.js';
import { makeSlayerActionButtons } from '@/lib/slayer/slayerActionButtons.js';
import { getSlayerBlocks } from '@/lib/slayer/slayerBlocks.js';
import { SlayerRewardsShop, SlayerTaskUnlocksEnum } from '@/lib/slayer/slayerUnlocks.js';
import {
	type MortimerModifierKind,
	type MortimerTaskSpec,
	mortimerSpecFor,
	mortimerTasks
} from '@/lib/slayer/tasks/mortimerTasks.js';
import type { AssignableSlayerTask } from '@/lib/slayer/types.js';

export const MORTIMER_ID = 9;
export const MORTIMER_SKIP_COST = 100;
export const MORTIMER_MAX_BLOCKS = 2;
export const MORTIMER_BLOCK_COST = 120;
export const MORTIMER_PICK_PREFIX = 'MORTIMER_PICK_';

const MODIFIER_UNLOCKS: Record<MortimerModifierKind, number> = {
	points: 0,
	quantity: 0,
	clue: 15,
	superior: 25,
	xp: 40
};
const THIRD_CHOICE_UNLOCK = 50;

export interface MortimerModifier {
	kind: MortimerModifierKind;
	value: number;
}

export interface MortimerOffer {
	monsterId: number;
	quantity: number;
	modifier: MortimerModifier;
}

const ready = { done: false };

async function ensureStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_mortimer (
			user_id text PRIMARY KEY,
			tasks_completed int NOT NULL DEFAULT 0,
			offers jsonb NULL
		)
	`);
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_slayer_task_modifier (
			task_id int PRIMARY KEY,
			kind text NOT NULL,
			value int NOT NULL
		)
	`);
	ready.done = true;
}

export function userCanUseMortimer(user: MUser): boolean {
	const slayer = user.skillsAsLevels.slayer;
	return (slayer >= 70 && user.combatLevel >= 100) || slayer >= 99;
}

export async function getMortimerState(
	userId: string
): Promise<{ tasksCompleted: number; offers: MortimerOffer[] | null }> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ tasks_completed: number; offers: MortimerOffer[] | null }[]>`
		SELECT tasks_completed, offers FROM bsc_mortimer WHERE user_id = ${userId} LIMIT 1
	`;
	return { tasksCompleted: rows[0]?.tasks_completed ?? 0, offers: rows[0]?.offers ?? null };
}

async function saveOffers(userId: string, offers: MortimerOffer[] | null) {
	await ensureStore();
	const json = offers ? JSON.stringify(offers) : null;
	await prisma.$executeRaw`
		INSERT INTO bsc_mortimer (user_id, offers) VALUES (${userId}, ${json}::jsonb)
		ON CONFLICT (user_id) DO UPDATE SET offers = EXCLUDED.offers
	`;
}

export async function incrementMortimerTasks(userId: string): Promise<number> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ tasks_completed: number }[]>`
		INSERT INTO bsc_mortimer (user_id, tasks_completed) VALUES (${userId}, 1)
		ON CONFLICT (user_id) DO UPDATE SET tasks_completed = bsc_mortimer.tasks_completed + 1
		RETURNING tasks_completed
	`;
	return rows[0].tasks_completed;
}

export async function getTaskModifier(taskId: number): Promise<MortimerModifier | null> {
	await ensureStore();
	const rows = await prisma.$queryRaw<{ kind: MortimerModifierKind; value: number }[]>`
		SELECT kind, value FROM bsc_slayer_task_modifier WHERE task_id = ${taskId} LIMIT 1
	`;
	return rows[0] ? { kind: rows[0].kind, value: rows[0].value } : null;
}

export function unlockedModifierKinds(tasksCompleted: number, spec: MortimerTaskSpec): MortimerModifierKind[] {
	return (Object.keys(MODIFIER_UNLOCKS) as MortimerModifierKind[]).filter(
		kind => tasksCompleted >= MODIFIER_UNLOCKS[kind] && (kind !== 'clue' || spec.modifiers.clue !== null)
	);
}

function rollInRange(rng: RNGProvider, [min, max]: readonly [number, number], step: number) {
	const steps = Math.floor((max - min) / step);
	return min + rng.randInt(0, steps) * step;
}

export function rollModifier(rng: RNGProvider, spec: MortimerTaskSpec, tasksCompleted: number): MortimerModifier {
	const kinds = unlockedModifierKinds(tasksCompleted, spec);
	const kind = rng.pick(kinds);
	const range = spec.modifiers[kind] ?? spec.modifiers.points;
	return { kind, value: rollInRange(rng, range, kind === 'points' ? 1 : 5) };
}

export function formatModifier(modifier: MortimerModifier): string {
	const sign = modifier.value >= 0 ? '+' : '';
	switch (modifier.kind) {
		case 'points':
			return `+${modifier.value} Slayer points`;
		case 'quantity':
			return `${sign}${modifier.value}% kills`;
		case 'clue':
			return `${sign}${modifier.value}% clue scrolls`;
		case 'superior':
			return `${sign}${modifier.value}% superior loot`;
		case 'xp':
			return `${sign}${modifier.value}% Slayer XP`;
	}
}

function taskName(monsterId: number) {
	const task = mortimerTasks.find(t => t.monster.id === monsterId);
	const name = task?.monster.name ?? Monsters.get(monsterId)?.name ?? String(monsterId);
	return name.endsWith('s') ? name : `${name}s`;
}

function canDoTask(user: MUser, task: AssignableSlayerTask, blocked: readonly number[]) {
	if (blocked.includes(task.monster.id)) return false;
	if (task.combatLevel && task.combatLevel > user.combatLevel) return false;
	if (task.slayerLevel && task.slayerLevel > user.skillsAsLevels.slayer) return false;
	if (task.questPoints && task.questPoints > user.QP) return false;
	if (task.requiredQuests?.some(quest => !user.user.finished_quest_ids.includes(quest))) return false;
	if (task.levelRequirements && !user.hasSkillReqs(task.levelRequirements)) return false;
	return true;
}

function rollQuantity(user: MUser, rng: RNGProvider, task: AssignableSlayerTask, modifier: MortimerModifier) {
	let quantity = rng.randInt(task.amount[0], task.amount[1]);
	const extendReward = SlayerRewardsShop.find(r => r.extendID?.includes(task.monster.id));
	if (extendReward && user.hasSlayerUnlock(extendReward.id)) {
		quantity = task.extendedAmount
			? rng.randInt(task.extendedAmount[0], task.extendedAmount[1])
			: Math.ceil(quantity * (extendReward.extendMult ?? 1));
	}
	if (modifier.kind === 'quantity') {
		quantity = Math.max(1, Math.round(quantity * (1 + modifier.value / 100)));
	}
	if (
		user.hasSlayerUnlock(SlayerTaskUnlocksEnum.SizeMatters) &&
		!user.bitfield.includes(BitField.DisableSizeMatters)
	) {
		quantity *= 2;
	}
	if (
		user.bitfield.includes(BitField.HasScrollOfLongevity) &&
		!user.bitfield.includes(BitField.ScrollOfLongevityDisabled)
	) {
		quantity *= 2;
	}
	return quantity;
}

function weightedPick(rng: RNGProvider, tasks: AssignableSlayerTask[]) {
	const total = tasks.reduce((sum, t) => sum + t.weight, 0);
	let roll = rng.randFloat(0, total);
	for (const task of tasks) {
		roll -= task.weight;
		if (roll <= 0) return task;
	}
	return tasks[tasks.length - 1];
}

export async function rollMortimerOffers(user: MUser, rng: RNGProvider): Promise<MortimerOffer[]> {
	const { tasksCompleted } = await getMortimerState(user.id);
	const blocked = await getSlayerBlocks(user.id, MORTIMER_ID);
	let pool = mortimerTasks.filter(task => canDoTask(user, task, blocked));
	const count = tasksCompleted >= THIRD_CHOICE_UNLOCK ? 3 : 2;
	const offers: MortimerOffer[] = [];
	while (offers.length < count && pool.length > 0) {
		const task = weightedPick(rng, pool);
		pool = pool.filter(t => t !== task);
		const spec = mortimerSpecFor(task.monster.id);
		if (!spec) continue;
		const modifier = rollModifier(rng, spec, tasksCompleted);
		offers.push({ monsterId: task.monster.id, quantity: rollQuantity(user, rng, task, modifier), modifier });
	}
	await saveOffers(user.id, offers);
	return offers;
}

export function mortimerOfferMessage(offers: MortimerOffer[], extraContent = '') {
	const lines = offers.map(
		(offer, i) =>
			`**${i + 1}.** ${offer.quantity}x ${taskName(offer.monsterId)} (${formatModifier(offer.modifier)})`
	);
	const buttons = offers.map((offer, i) =>
		new ButtonBuilder()
			.setCustomId(`${MORTIMER_PICK_PREFIX}${i}`)
			.setLabel(`${i + 1}. ${taskName(offer.monsterId)}`.slice(0, 80))
			.setStyle(ButtonStyle.Secondary)
	);
	return {
		content:
			`${extraContent}Mortimer offers you a choice of tasks:\n${lines.join('\n')}\n\nPick one with the buttons below. You can't get a task from any other master until you pick.`.trim(),
		components: buttons
	};
}

export async function pickMortimerOffer(
	user: MUser,
	index: number
): Promise<string | { content: string; components: ButtonBuilder[] }> {
	const { offers } = await getMortimerState(user.id);
	if (!offers || offers.length === 0) return "Mortimer hasn't offered you any tasks. Ask him for one first.";
	const offer = offers[index];
	if (!offer) return 'That choice is no longer available.';
	if (await user.minionIsBusy()) return 'Your minion is busy, try again when it has returned.';
	const { currentTask } = await user.fetchSlayerInfo();
	if (currentTask) return 'You already have a slayer task.';

	const task = await prisma.slayerTask.create({
		data: {
			user_id: user.id,
			quantity: offer.quantity,
			quantity_remaining: offer.quantity,
			slayer_master_id: MORTIMER_ID,
			monster_id: offer.monsterId,
			skipped: false
		}
	});
	await prisma.$executeRaw`
		INSERT INTO bsc_slayer_task_modifier (task_id, kind, value)
		VALUES (${task.id}, ${offer.modifier.kind}, ${offer.modifier.value})
		ON CONFLICT (task_id) DO NOTHING
	`;
	await saveOffers(user.id, null);
	await user.update({ slayer_last_task: offer.monsterId });
	return {
		content: `Mortimer has assigned you to kill ${offer.quantity}x ${taskName(offer.monsterId)} (${formatModifier(offer.modifier)}).`,
		components: makeSlayerActionButtons(MORTIMER_SKIP_COST, MORTIMER_BLOCK_COST)
	};
}

export function bonusRolls(rng: RNGProvider, count: number, percent: number) {
	let extra = 0;
	for (let i = 0; i < count; i++) {
		extra += Math.floor(percent / 100);
		if (rng.percentChance(percent % 100)) extra++;
	}
	return extra;
}
