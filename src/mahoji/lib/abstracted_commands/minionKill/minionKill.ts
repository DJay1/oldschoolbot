import { igneCommand } from '@/lib/bso/commands/igneCommand.js';
import { kgCommand } from '@/lib/bso/commands/kgCommand.js';
import { kkCommand } from '@/lib/bso/commands/kkCommand.js';
import { moktangCommand } from '@/lib/bso/commands/moktangCommand.js';
import { naxxusCommand } from '@/lib/bso/commands/naxxusCommand.js';
import { vasaCommand } from '@/lib/bso/commands/vasaCommand.js';
import { handleDTD } from '@/lib/bso/handleDTD.js';
import { Slayer2026MonsterID } from '@/lib/bso/monsters/slayer2026Ids.js';

import { customEmoji, formatDuration, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Monsters } from 'oldschooljs';

import { colosseumCommand } from '@/lib/colosseum.js';
import type { PvMMethod } from '@/lib/constants.js';
import { trackLoot } from '@/lib/lootTrack.js';
import { revenantMonsters } from '@/lib/minions/data/killableMonsters/revs.js';
import type { KillableMonster } from '@/lib/minions/types.js';
import type { CurrentSlayerInfo } from '@/lib/slayer/slayerUtil.js';
import type { MonsterActivityTaskOptions } from '@/lib/types/minions.js';
import findMonster from '@/lib/util/findMonster.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { generateDailyPeakIntervals } from '@/lib/util/peaks.js';
import { MAX_QUANTITY, validateQuantity } from '@/lib/util/validateQuantity.js';
import {
	type MinionKillReturn,
	newMinionKillCommand
} from '@/mahoji/lib/abstracted_commands/minionKill/newMinionKill.js';
import { nexCommand } from '@/mahoji/lib/abstracted_commands/nexCommand.js';
import { nightmareCommand } from '@/mahoji/lib/abstracted_commands/nightmareCommand.js';
import { getPOH } from '@/mahoji/lib/abstracted_commands/pohCommand.js';
import { temporossCommand } from '@/mahoji/lib/abstracted_commands/temporossCommand.js';
import { wintertodtCommand } from '@/mahoji/lib/abstracted_commands/wintertodtCommand.js';
import { zalcanoCommand } from '@/mahoji/lib/abstracted_commands/zalcanoCommand.js';

const invalidMonsterMsg = "That isn't a valid monster.\n\nFor example, `/k name:zulrah quantity:5`";

export async function minionKillCommand(
	user: MUser,
	interaction: OSInteraction,
	channelId: string,
	name: string,
	rng: RNGProvider,
	inputQuantity: number | undefined,
	method: PvMMethod | undefined,
	wilderness: boolean | undefined,
	_solo: boolean | undefined,
	onTask: boolean | undefined,
	takeEggs?: boolean
): CommandResponse {
	if (inputQuantity !== undefined) {
		const parsedQuantity = validateQuantity(inputQuantity, { min: 1, max: MAX_QUANTITY });
		if (!parsedQuantity.ok) return parsedQuantity.error;
		inputQuantity = parsedQuantity.value;
	}
	if (await user.minionIsBusy()) {
		return 'Your minion is busy.';
	}

	if (!name) return invalidMonsterMsg;

	if (user.usingPet('Ishi')) {
		name = 'Ogress Warrior';
	}
	if (stringMatches(name, 'colosseum')) return colosseumCommand(interaction, inputQuantity);
	if (stringMatches(name, 'zalcano')) return zalcanoCommand(rng, user, channelId, inputQuantity);
	if (stringMatches(name, 'tempoross')) return temporossCommand(user, channelId, inputQuantity);
	if (name.toLowerCase().includes('nightmare')) return nightmareCommand(user, channelId, name, inputQuantity);
	if (name.toLowerCase().includes('wintertodt')) return wintertodtCommand(user, channelId);
	if (['igne ', 'ignecarus'].some(i => name.toLowerCase().includes(i))) {
		return igneCommand(interaction, user, channelId, name, inputQuantity);
	}
	if (['kg', 'king goldemar'].some(i => name.toLowerCase().includes(i))) {
		return kgCommand(interaction, user, channelId, name, inputQuantity);
	}
	if (['kk', 'kalphite king'].some(i => name.toLowerCase().includes(i)))
		return kkCommand(interaction, user, channelId, name, inputQuantity);
	if (name.toLowerCase().includes('nex')) return nexCommand(interaction, user, channelId, name, inputQuantity);
	if (name.toLowerCase().includes('moktang')) return moktangCommand(user, channelId, inputQuantity);
	if (name.toLowerCase().includes('naxxus')) return naxxusCommand(user, channelId, inputQuantity);
	if (['vasa', 'vasa magus'].some(i => name.toLowerCase().includes(i))) {
		return vasaCommand(interaction, user, channelId, inputQuantity);
	}

	const monster = findKillMonster(name);
	if (!monster) return invalidMonsterMsg;

	const [hasReqs, reason] = await user.hasMonsterRequirements(monster);
	if (!hasReqs) {
		return typeof reason === 'string' ? reason : "You don't have the requirements to fight this monster";
	}

	const slayerInfo = await user.fetchSlayerInfo();

	if (slayerInfo.assignedTask === null && onTask) return 'You are no longer on a slayer task for this monster!';

	const calculated = await calculateMinionKill({ user, monster, slayerInfo, rng, inputQuantity, method, wilderness });
	if (typeof calculated === 'string') return calculated;
	const { result } = calculated;

	if (!user.allItemsOwned.has(result.updateBank.itemCostBank)) {
		return `You don't have the items needed to kill this monster. You're missing: ${result.updateBank.itemCostBank.clone().remove(user.allItemsOwned)}`;
	}

	return startMinionKillTrip({ user, channelId, monster, result, slayerInfo, inputQuantity, takeEggs });
}

function findKillMonster(name: string) {
	const matchedRevenantMonster = revenantMonsters.find(monster =>
		monster.aliases.some(alias => stringMatches(alias, name))
	);
	return matchedRevenantMonster ?? findMonster(name);
}

async function calculateMinionKill({
	user,
	monster,
	slayerInfo,
	rng,
	inputQuantity,
	method,
	wilderness
}: {
	user: MUser;
	monster: KillableMonster;
	slayerInfo: CurrentSlayerInfo;
	rng: RNGProvider;
	inputQuantity: number | undefined;
	method: PvMMethod | undefined;
	wilderness: boolean | undefined;
}): Promise<string | { result: MinionKillReturn; maxTripLength: number }> {
	const pkEvasionExperience = await user.fetchUserStat('pk_evasion_exp');

	const royalTitansGroupIDs = [Monsters.Branda.id, Monsters.Eldric.id, Monsters.RoyalTitans.id];

	const kcs = await user.getAllKCs();
	let kcForBonus = kcs[monster.id];

	if (royalTitansGroupIDs.includes(monster.id)) {
		kcForBonus = kcs.BRANDA + kcs.ELDRIC + kcs.ROYAL_TITANS;
	}

	const maxTripLength = await user.calcMaxTripLength('MonsterKilling');
	const killArgs = {
		gearBank: user.gearBank,
		attackStyles: user.getAttackStyles(),
		currentSlayerTask: slayerInfo,
		monster,
		isTryingToUseWildy: wilderness ?? false,
		monsterKC: kcForBonus,
		inputPVMMethod: method,
		maxTripLength,
		pkEvasionExperience,
		poh: await getPOH(user.id),
		inputQuantity,
		combatOptions: user.combatOptions,
		slayerUnlocks: user.user.slayer_unlocks,
		favoriteFood: user.user.favorite_food,
		bitfield: user.bitfield,
		disabledInventions: user.user.disabled_inventions,
		currentPeak: generateDailyPeakIntervals().currentPeak,
		rng
	};
	let result = newMinionKillCommand(killArgs);

	// Speed boosts (weekend, items, etc.) shorten the trip after the kill count is picked.
	// When no quantity was given, refill the trip up to the max length with those boosts counted.
	if (typeof result !== 'string' && inputQuantity === undefined && result.duration < maxTripLength) {
		const inflatedMax = Math.floor(maxTripLength * (maxTripLength / result.duration));
		let candidate = newMinionKillCommand({ ...killArgs, maxTripLength: inflatedMax });
		for (let i = 0; i < 6 && typeof candidate !== 'string' && candidate.duration > maxTripLength; i++) {
			const nextQty = candidate.quantity - 1;
			if (nextQty <= result.quantity) break;
			candidate = newMinionKillCommand({ ...killArgs, maxTripLength: inflatedMax, inputQuantity: nextQty });
		}
		if (
			typeof candidate !== 'string' &&
			candidate.duration <= maxTripLength &&
			candidate.quantity > result.quantity
		) {
			result = candidate;
		}
	}

	if (typeof result === 'string') {
		return result;
	}
	return { result, maxTripLength };
}

async function startMinionKillTrip({
	user,
	channelId,
	monster,
	result,
	slayerInfo,
	inputQuantity,
	takeEggs
}: {
	user: MUser;
	channelId: string;
	monster: KillableMonster;
	result: MinionKillReturn;
	slayerInfo: CurrentSlayerInfo;
	inputQuantity: number | undefined;
	takeEggs: boolean | undefined;
}): CommandResponse {
	const { minionName } = user;
	const updateResult = await result.updateBank.transact(user, { isInWilderness: result.isInWilderness });
	if (typeof updateResult === 'string') {
		return updateResult;
	}

	const dtdResult = await handleDTD(monster, user);
	if (typeof dtdResult === 'string') {
		return dtdResult;
	}

	if (updateResult.message.length > 0) result.messages.push(updateResult.message);

	if (updateResult.totalCost.length > 0) {
		result.messages.push(`Removing items: ${updateResult.totalCost}`);
	}

	if (result.updateBank.itemCostBank.length > 0) {
		await ClientSettings.updateBankSetting('economyStats_PVMCost', result.updateBank.itemCostBank);
		await trackLoot({
			id: monster.name,
			totalCost: result.updateBank.itemCostBank,
			type: 'Monster',
			changeType: 'cost',
			users: [
				{
					id: user.id,
					cost: result.updateBank.itemCostBank
				}
			]
		});
	}

	const { bob, usingCannon, cannonMulti, chinning, died, pkEncounters, hasWildySupplies } = result.currentTaskOptions;
	await ActivityManager.startTrip<MonsterActivityTaskOptions>({
		mi: monster.id,
		userID: user.id,
		channelId,
		q: result.quantity,
		iQty: inputQuantity,
		duration: dtdResult ? Time.Second * 5 : result.duration,
		type: 'MonsterKilling',
		usingCannon: !usingCannon ? undefined : usingCannon,
		cannonMulti: !cannonMulti ? undefined : cannonMulti,
		chinning: !chinning ? undefined : chinning,
		bob: !bob ? undefined : bob,
		died,
		pkEncounters,
		hasWildySupplies,
		isInWilderness: result.isInWilderness === true ? true : undefined,
		attackStyles: result.attackStyles,
		onTask: slayerInfo.assignedTask !== null,
		takeEggs: takeEggs && monster.id === Slayer2026MonsterID.MAGGOT_KING ? true : undefined
	});

	let response = `${minionName} is now killing ${result.quantity}x ${monster.name}, ${dtdResult ? `using a ${customEmoji('deathtouched_dart')} **Deathtouched dart**, it'll take around ${formatTripDuration(user, Time.Second * 5)}` : `It'll take around ${formatTripDuration(user, result.duration)} to finish`}. Attack styles used: ${result.attackStyles.join(', ')}.`;

	if (result.messages.length > 0) {
		response += `\n\n${result.messages.join(', ')}`;
	}

	return response;
}

export async function minionKillInfoCommand(
	user: MUser,
	name: string,
	rng: RNGProvider,
	method: PvMMethod | undefined,
	wilderness: boolean | undefined
): CommandResponse {
	const monster = findKillMonster(name);
	if (!monster) return invalidMonsterMsg;

	const lines = [`**${monster.name}**`];
	const [hasReqs, reason] = await user.hasMonsterRequirements(monster);
	if (!hasReqs) {
		lines.push(`You can't kill this yet: ${typeof reason === 'string' ? reason : 'missing requirements'}`);
	}
	lines.push(`**Barrage/Burst:** ${monster.canBarrage ? 'Yes' : 'No'}`);
	lines.push(
		`**Cannon:** ${monster.canCannon ? `Yes, ${monster.cannonMulti ? 'multi' : 'single'} combat area` : 'No'}`
	);
	if (monster.qpRequired) lines.push(`**Quest points:** ${monster.qpRequired} required, you have ${user.QP}`);
	if (!hasReqs) return lines.join('\n');

	const slayerInfo = await user.fetchSlayerInfo();
	const calculated = await calculateMinionKill({
		user,
		monster,
		slayerInfo,
		rng,
		inputQuantity: undefined,
		method,
		wilderness
	});
	if (typeof calculated === 'string') {
		lines.push('', calculated);
		return lines.join('\n');
	}
	const { result, maxTripLength } = calculated;

	lines.push(
		'',
		'**Trip**',
		`You can kill **${result.quantity}x** in ${formatDuration(result.duration)} (${formatDuration(result.duration / result.quantity)} per kill, max trip ${formatDuration(maxTripLength)}).`,
		`On task: ${result.isOnTask ? 'Yes' : 'No'}${result.isInWilderness ? ', in the Wilderness' : ''}. Attack styles: ${result.attackStyles.join(', ')}.`
	);
	if (result.messages.length > 0) lines.push('', '**Boosts**', result.messages.join(', '));
	const cost = result.updateBank.itemCostBank;
	if (cost.length > 0) {
		lines.push('', `**Supplies for a full trip:** ${cost}`);
		if (!user.allItemsOwned.has(cost)) lines.push(`You're missing: ${cost.clone().remove(user.allItemsOwned)}`);
	}
	return lines.join('\n');
}
