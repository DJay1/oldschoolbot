import { giveBoxResetTime, SPAWN_BOX_COOLDOWN, spawnLampResetTime } from '@/lib/bso/bsoConstants.js';
import { BSOEmoji } from '@/lib/bso/bsoEmoji.js';
import { buttonUserPicker } from '@/lib/bso/buttonUserPicker.js';
import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { time, userMention } from '@oldschoolgg/discord';
import { Emoji, formatDuration, PerkTier, Time } from '@oldschoolgg/toolkit';
import { MathRNG, randArrItem, randInt, roll } from 'node-rng';
import { Bank, convertLVLtoXP, itemID } from 'oldschooljs';

import { BitField, Channel, globalConfig } from '@/lib/constants.js';

export async function spawnLampIsReady(user: MUser, channelId: string): Promise<[true] | [false, string]> {
	if (globalConfig.isProduction && ![Channel.GeneralChannel, Channel.ServerGeneral].includes(channelId)) {
		return [false, "You can't use spawnlamp in this channel."];
	}

	const perkTier = await user.fetchPerkTier();
	const isPatron = perkTier >= PerkTier.Four || user.bitfield.includes(BitField.HasPermanentSpawnLamp);
	if (!isPatron) {
		return [false, 'You need to be a T3 patron or higher to use this command.'];
	}
	const currentDate = Date.now();
	const lastDate = Number(user.user.lastSpawnLamp);
	const difference = currentDate - lastDate;

	const cooldown = spawnLampResetTime(user, perkTier);

	if (difference < cooldown) {
		const duration = formatDuration(Date.now() - (lastDate + cooldown));
		return [false, `You can spawn another lamp in ${duration}.`];
	}
	return [true];
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

export async function spawnLampCommand(user: MUser, interaction: MInteraction): CommandResponse {
	if (globalConfig.isProduction && interaction.guildId !== globalConfig.supportServerID) {
		return 'You can only use this command in the support server.';
	}
	const [lampIsReady, reason] = user.isAdmin() ? [true, ''] : await spawnLampIsReady(user, interaction.channelId);
	if (!lampIsReady && reason) return reason;

	const group = await findGroupOfUser(user.id);
	await prisma.user.updateMany({
		where: {
			id: {
				in: group
			}
		},
		data: {
			lastSpawnLamp: Date.now()
		}
	});

	const { answers, question, explainAnswer } = generateXPLevelQuestion();

	const winnerId = await buttonUserPicker({
		interaction,
		str: `${BSOEmoji.HugeLamp} ${userMention(user.id)} spawned a Lamp: ${question}`,
		timer: Time.Minute,
		ironmenAllowed: false,
		answers,
		creator: user.id,
		creatorGetsTwoGuesses: true
	});
	if (!winnerId) return `Nobody got it. ${explainAnswer}`;
	const winner = await mUserFetch(winnerId);
	const loot = LampTable.roll();
	await winner.addItemsToBank({ items: loot, collectionLog: false });
	return `${winner} got it, and won **${loot}**! ${explainAnswer}`;
}

export async function spawnBoxCommand(user: MUser, interaction: MInteraction): CommandResponse {
	const perkTier = await user.fetchPerkTier();
	if (perkTier < PerkTier.Four && !user.bitfield.includes(BitField.HasPermanentEventBackgrounds)) {
		return 'You need to be a T3 patron or higher to use this command.';
	}
	if (globalConfig.isProduction && ![Channel.GeneralChannel, Channel.ServerGeneral].includes(interaction.channelId)) {
		return "You can't use spawnbox in this channel.";
	}
	const lastUse = Number(user.user.last_spawn_box_date ?? 0);
	const difference = Date.now() - lastUse;
	const isOnCooldown = difference < SPAWN_BOX_COOLDOWN ? SPAWN_BOX_COOLDOWN - difference : null;
	if (isOnCooldown !== null) {
		return `This command is on cooldown for you for ${formatDuration(isOnCooldown)}.`;
	}
	await user.update({
		last_spawn_box_date: Date.now()
	});
	const { answers, question, explainAnswer } = generateXPLevelQuestion();
	const timeToAnswer = Time.Minute;

	const winnerId = await buttonUserPicker({
		interaction,
		str: `${Emoji.MysteryBox} ${userMention(user.id)} spawned a Mystery Box. Answer within ${time(Math.floor((Date.now() + timeToAnswer) / 1000), 'R')}.

${question}`,
		timer: timeToAnswer,
		ironmenAllowed: false,
		answers,
		creator: user.id
	});
	if (!winnerId) return `Nobody got it. ${explainAnswer}`;
	const winner = await mUserFetch(winnerId);

	const loot = new Bank().add(MysteryBoxes.roll());
	await winner.addItemsToBank({ items: loot, collectionLog: false });
	return `Congratulations, ${winner}! You received: **${loot}**. ${explainAnswer}`;
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
