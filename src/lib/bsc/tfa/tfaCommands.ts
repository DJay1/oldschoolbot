import { bold } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank, type ItemBank } from 'oldschooljs';
import { clamp } from 'remeda';

import {
	checkTfaUser,
	createTfaRaids,
	minTfaStats,
	TFA_MAX_QUANTITY,
	TFA_MIN_GEAR_PERCENT,
	tfaChargesNeeded,
	tfaHelpBoostsText,
	tfaItemBoosts,
	tfaSingleRaidDuration,
	tfaSuppliesPerRaid,
	tfaTeamMemberFromUser,
	tfaUserSpeedReduction
} from '@/lib/bsc/tfa/tfa.js';
import { tfaFragmentsUsed } from '@/lib/bsc/tfa/tfaFragments.js';
import { tfaUniqueItems } from '@/lib/bsc/tfa/tfaItems.js';
import { tfaTeamUniqueOdds } from '@/lib/bsc/tfa/tfaLoot.js';
import type { TFAOptions } from '@/lib/bsc/tfa/tfaTypes.js';
import { BitField } from '@/lib/constants.js';
import { calculateTfaGearPercents } from '@/lib/bsc/tfa/tfa.js';
import { degradeableItems, degradeItem } from '@/lib/degradeableItems.js';
import { trackLoot } from '@/lib/lootTrack.js';
import type { MakePartyOptions } from '@/lib/types/index.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const RAID_NAME = 'The Fractured Archive';

export async function tfaStartCommand(
	interaction: MInteraction | null | undefined,
	user: MUser,
	solo: boolean,
	channelId: string,
	teamSize: number | undefined,
	quantityInput: number | undefined
): CommandResponse {
	if (await user.minionIsBusy()) return `${user.usernameOrMention} minion is busy.`;

	const initialCheck = checkTfaUser(user, 1);
	if (initialCheck) return initialCheck;

	const maxSize = mahojiParseNumber({ input: teamSize, min: 2, max: 8 }) ?? 8;

	let users: MUser[];
	if (solo || !interaction) {
		users = [user];
	} else {
		const partyOptions: MakePartyOptions = {
			interaction,
			leader: user,
			minSize: 1,
			maxSize,
			ironmanAllowed: true,
			message: `${user.usernameOrMention} is hosting a ${RAID_NAME} mass! Use the buttons below to join/leave.`,
			customDenier: async checkUser => {
				const res = checkTfaUser(checkUser, 1);
				if (res) return [true, res];
				return [false];
			}
		};
		users = (await globalClient.makeParty(partyOptions)).slice(0, maxSize);
	}

	if (users.length < 1 || users.length > 8) return 'Your team must be 1-8 players.';
	if (new Set(users.map(u => u.id)).size !== users.length) return 'A player is in your team twice.';
	if (await ActivityManager.anyMinionIsBusy(users.map(u => u.id))) {
		return 'One of the users in your mass has a busy minion.';
	}

	// Fresh data for everyone right before the checks and supply removal.
	users = await Promise.all(users.map(u => mUserFetch(u.id)));

	const team = await Promise.all(
		users.map(async u => tfaTeamMemberFromUser(u, await u.fetchMinigameScore('fractured_archive')))
	);

	const singleRaid = tfaSingleRaidDuration(team);
	const maxTripLength = Math.min(...(await Promise.all(users.map(u => u.calcMaxTripLength('FracturedArchive')))));
	const maxQuantity = clamp(Math.floor(maxTripLength / singleRaid), { min: 1, max: TFA_MAX_QUANTITY });
	const quantity = clamp(quantityInput ?? maxQuantity, { min: 1, max: maxQuantity });

	for (const u of users) {
		const res = checkTfaUser(u, quantity);
		if (res) {
			return {
				content: `Your mass failed to start because of this reason: ${res}`,
				allowedMentions: { users: users.map(i => i.id) }
			};
		}
	}

	const { raids, realDuration, fakeDuration } = createTfaRaids({ team, quantity });

	const supplies = tfaSuppliesPerRaid.clone().multiply(quantity);
	const totalCost = new Bank();
	const costs: { id: string; cost: Bank }[] = [];
	let details = '';
	for (let i = 0; i < users.length; i++) {
		const u = users[i];
		await u.transactItems({ itemsToRemove: supplies.clone() });
		await u.statsBankUpdate('tfa_cost', supplies);
		for (const charge of tfaChargesNeeded(u, quantity)) {
			const degItem = degradeableItems.find(d => d.item.id === charge.itemID)!;
			await degradeItem({ item: degItem.item, chargesToDegrade: charge.charges, user: u });
		}
		totalCost.add(supplies);
		costs.push({ id: u.id, cost: supplies.clone() });
		const member = team[i];
		const boostNames = member.boosts.map(b => b.name);
		details += `**- ${u.usernameOrMention}** Gear: ${member.gear.total.toFixed(1)}% | Speed: ${tfaUserSpeedReduction(member).toFixed(1)}%${
			boostNames.length > 0 ? ` | Boosts: ${boostNames.join(', ')}` : ''
		}${member.deathReduction > 0 ? ' | Rondache' : ''}\n`;
	}

	await ClientSettings.updateBankSetting('tfa_cost', totalCost);
	await trackLoot({
		totalCost,
		id: 'fractured_archive',
		type: 'Minigame',
		changeType: 'cost',
		users: costs.map(c => ({ id: c.id, cost: c.cost, duration: realDuration }))
	});

	await ActivityManager.startTrip<TFAOptions>({
		userID: user.id,
		channelId,
		duration: realDuration,
		type: 'FracturedArchive',
		leader: user.id,
		users: users.map(u => u.id),
		fakeDuration,
		quantity,
		raids,
		repeatMaxSize: solo || !interaction ? undefined : maxSize
	});

	return `${user.usernameOrMention}'s party (${users.map(u => u.usernameOrMention).join(', ')}) is now off to do ${
		quantity === 1 ? 'a' : `${quantity}x`
	} ${RAID_NAME} raid${quantity === 1 ? '' : 's'} - the total trip will take ${formatDuration(fakeDuration)}. Team unique chance: 1 in ${tfaTeamUniqueOdds(users.length)} per raid.

${details}Each player used: ${supplies}`;
}

export async function tfaHelpCommand(user: MUser): Promise<string> {
	const gear = calculateTfaGearPercents(user);
	const kc = await user.fetchMinigameScore('fractured_archive');
	const stats = await user.fetchStats();
	const uniques = tfaUniqueItems.reduce((acc, id) => acc + user.cl.amount(id), 0);
	const { boosts, deathReduction } = tfaItemBoosts(user);
	const check = checkTfaUser(user, 1);
	const minutes = stats.tfa_total_minutes ?? 0;

	return `**${RAID_NAME}**

**KC:** ${kc}
**Attempts:** ${stats.tfa_attempts ?? 0}
**Uniques:** ${uniques}${uniques > 0 ? ` (one every ${Math.floor(kc / uniques)} raids, one every ${formatDuration((minutes * Time.Minute) / uniques)})` : ''}

**Requirements**
- While Guthix Sleeps
- ${formatSkillRequirements(minTfaStats)}
- At least ${TFA_MIN_GEAR_PERCENT}% in your melee, range and mage setups (yours: melee ${gear.melee.toFixed(1)}%, range ${gear.range.toFixed(1)}%, mage ${gear.mage.toFixed(1)}%)
- Supplies per raid: ${tfaSuppliesPerRaid}

**How it works**
Archive Guardian, then one of Ezekiel or Bork and the Smorks, one of Moia or Dreadnoth the Jellied, one of The Dagon'hai or Xarth, then Ocellus. Bosses are picked at random each raid.
Team unique chance is 1/16 solo or duo, down to 1/7.5 with 8. The unique goes to one player weighted by contribution points (700 per raid, split by damage; each death costs 10% of your expected share). Everyone else gets 3 rolls on the normal loot. If the whole team dies at a boss, the raid fails and the supplies are lost.

**Boosts**
${tfaHelpBoostsText()
	.map(b => `- ${b}`)
	.join('\n')}
- Each used elemental fragment: 0.5% faster (you've used ${tfaFragmentsUsed(user)}/4)

**Your boosts:** ${boosts.length > 0 ? boosts.map(b => `${b.name} (${b.percent}%)`).join(', ') : 'None'}${deathReduction > 0 ? ', Rondache' : ''}
**Zeal:** ${user.bitfield.includes(BitField.HasZeal) ? 'Unlocked' : 'Locked'}

${check ? `\u26A0\uFE0F ${bold('Not ready:')} ${check}` : '\u2705 You are ready to start a raid.'}`;
}

export async function tfaStatsCommand(user: MUser): Promise<string> {
	const kc = await user.fetchMinigameScore('fractured_archive');
	const stats = await user.fetchStats();
	const loot = new Bank(stats.tfa_loot as ItemBank);
	const cost = new Bank(stats.tfa_cost as ItemBank);
	return `**${RAID_NAME} stats**
**KC:** ${kc}
**Attempts:** ${stats.tfa_attempts ?? 0}
**Time raided:** ${formatDuration((stats.tfa_total_minutes ?? 0) * Time.Minute)}
**Loot value:** ${loot.value().toLocaleString()} GP
**Supplies used:** ${cost.length > 0 ? cost.toString() : 'None'}`;
}
