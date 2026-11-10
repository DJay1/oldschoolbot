import { giveBoxResetTime, SPAWN_BOX_COOLDOWN, SPAWN_LAMP_COOLDOWN } from '@/lib/bso/bsoConstants.js';
import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';
import { buttonUserPicker } from '@/lib/bso/buttonUserPicker.js';
import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { time, userMention } from '@oldschoolgg/discord';
import { Emoji, formatDuration, PerkTier, Time } from '@oldschoolgg/toolkit';
import { MathRNG, randArrItem, randInt, roll } from 'node-rng';
import { Bank, convertLVLtoXP, itemID } from 'oldschooljs';

import { BitField, globalConfig, SPAWN_CHANNEL_ID, spawnChannelMessage } from '@/lib/constants.js';
import { withPatreonLink } from '@/lib/patreonLink.js';

type SpawnKind = 'lamp' | 'box';

const SPAWN_KINDS = {
	lamp: {
		label: 'Lamp',
		emoji: () => BSOEmoji.HugeLamp,
		perkName: 'Spawn lamp',
		cooldown: SPAWN_LAMP_COOLDOWN,
		permanentBit: BitField.HasPermanentSpawnLamp,
		lastUsed: (user: MUser) => Number(user.user.lastSpawnLamp ?? 0),
		stamp: (now: number) => ({ lastSpawnLamp: now }),
		rollLoot: () => LampTable.roll(),
		winMessage: (winner: MUser, loot: Bank) => `${winner} got it, and won **${loot}**!`
	},
	box: {
		label: 'Mystery Box',
		emoji: () => Emoji.MysteryBox,
		perkName: 'Spawn box',
		cooldown: SPAWN_BOX_COOLDOWN,
		permanentBit: BitField.HasPermanentEventBackgrounds,
		lastUsed: (user: MUser) => Number(user.user.last_spawn_box_date ?? 0),
		stamp: (now: number) => ({ last_spawn_box_date: now }),
		rollLoot: () => new Bank().add(MysteryBoxes.roll()),
		winMessage: (winner: MUser, loot: Bank) => `Congratulations, ${winner}! You received: **${loot}**.`
	}
} as const;

/** Shared readiness check for spawn lamp and spawn box (perk, channel, one cooldown). */
export async function spawnIsReady(user: MUser, channelId: string, kind: SpawnKind): Promise<[true] | [false, string]> {
	const cfg = SPAWN_KINDS[kind];
	if (user.isAdmin()) return [true];
	const perkTier = await user.fetchPerkTier();
	if (perkTier < PerkTier.Five && !user.bitfield.includes(cfg.permanentBit)) {
		return [false, withPatreonLink(`${cfg.perkName} is an Alpha perk.`)];
	}
	if (globalConfig.isProduction && channelId !== SPAWN_CHANNEL_ID) {
		return [false, spawnChannelMessage];
	}
	const left = cfg.cooldown - (Date.now() - cfg.lastUsed(user));
	if (left > 0) {
		return [false, `You can spawn another ${cfg.label.toLowerCase()} in ${formatDuration(left)}.`];
	}
	return [true];
}

export function spawnLampIsReady(user: MUser, channelId: string) {
	return spawnIsReady(user, channelId, 'lamp');
}

export function spawnBoxIsReady(user: MUser, channelId: string) {
	return spawnIsReady(user, channelId, 'box');
}

/**
 * Four button choices. `answers[0]` is the real level; the picker shuffles them.
 */
export function generateXPLevelQuestion() {
	const level = randInt(1, 120);
	const xp = randInt(convertLVLtoXP(level), convertLVLtoXP(level + 1) - 1);

	const chanceOfSwitching = randInt(1, 4);
	const answers: string[] = [level.toString()];
	const direction = MathRNG.shuffle(['plus', 'minus']);

	while (answers.length < 4) {
		const modifier = randArrItem([1, 1, 2, 2, 3, 4, 5, 5, 6, 7, 7, 8, 9, 10, 10]);
		if (modifier === undefined) continue;
		const action = roll(chanceOfSwitching) ? direction[0] : direction[1];
		let potentialAnswer = action === 'plus' ? level + modifier : level - modifier;
		if (potentialAnswer < 1) potentialAnswer = level + modifier;
		else if (potentialAnswer > 120) potentialAnswer = level - modifier;
		if (answers.includes(potentialAnswer.toString())) continue;
		answers.push(potentialAnswer.toString());
	}

	return {
		question: `What level would you be at with **${xp.toLocaleString()}** XP?`,
		answers,
		explainAnswer: `${xp.toLocaleString()} is level ${level}!`
	};
}

async function spawnCommand(user: MUser, interaction: MInteraction, kind: SpawnKind): CommandResponse {
	const cfg = SPAWN_KINDS[kind];
	const [ready, reason] = await spawnIsReady(user, interaction.channelId, kind);
	if (!ready) return reason;

	// Start the cooldown for the spawner (and linked accounts) before the game runs.
	const now = Date.now();
	const group = await findGroupOfUser(user.id);
	const others = group.filter(id => id !== user.id);
	if (others.length > 0) {
		await prisma.user.updateMany({ where: { id: { in: others } }, data: cfg.stamp(now) });
	}
	await user.update(cfg.stamp(now));

	const { answers, question, explainAnswer } = generateXPLevelQuestion();
	const timeToAnswer = Time.Second * 30;
	const winnerId = await buttonUserPicker({
		interaction,
		str: `${cfg.emoji()} ${userMention(user.id)} spawned a ${cfg.label} (they get a 5s head start). Answer within ${time(Math.floor((now + timeToAnswer) / 1000), 'R')}.

${question}`,
		timer: timeToAnswer,
		ironmenAllowed: false,
		answers,
		creator: user.id,
		creatorGetsTwoGuesses: true
	});
	if (!winnerId) return `Nobody got it. ${explainAnswer}`;
	const winner = await mUserFetch(winnerId);
	const loot = cfg.rollLoot();
	await winner.addItemsToBank({ items: loot, collectionLog: false });
	return `${cfg.winMessage(winner, loot)} ${explainAnswer}`;
}

export function spawnLampCommand(user: MUser, interaction: MInteraction): CommandResponse {
	return spawnCommand(user, interaction, 'lamp');
}

export function spawnBoxCommand(user: MUser, interaction: MInteraction): CommandResponse {
	return spawnCommand(user, interaction, 'box');
}

export async function giveBox(user: MUser, _recipient: MahojiUserOption) {
	if (!_recipient) return 'You need to specify a user to give a box to.';
	const recipient = await mUserFetch(_recipient.user.id);

	const currentDate = Date.now();
	const lastDate = Number(user.user.lastGivenBoxx);
	const difference = currentDate - lastDate;

	// If no user or not an owner and can not send one yet, show time till next box.
	if (difference < giveBoxResetTime && !user.isAdmin()) {
		return `You can give another box in ${formatDuration(giveBoxResetTime - difference)}`;
	}

	if (recipient.id === user.id) return "You can't give boxes to yourself!";
	if (recipient.isIronman) return "You can't give boxes to ironmen!";
	await user.update({
		lastGivenBoxx: currentDate
	});

	const boxToReceive = new Bank().add(roll(10) ? MysteryBoxes.roll() : itemID('Mystery box'));

	await recipient.addItemsToBank({ items: boxToReceive, collectionLog: false });

	return `Gave **${boxToReceive}** to ${recipient}.`;
}
