import { CollectionLog } from '@oldschoolgg/collectionlog';
import { dateFm } from '@oldschoolgg/discord';
import { stringMatches } from '@oldschoolgg/toolkit';
import { randInt } from 'node-rng';
import { Bank, Items } from 'oldschooljs';

import { claimBscSupporterCosmetic } from '@/lib/bsc/patronSync.js';
import { BitField, BOT_TYPE, Channel } from '@/lib/constants.js';
import { calcCLDetails } from '@/lib/data/Collections.js';
import { halloweenClaimHoldMessage } from '@/lib/events/halloween/claim.js';
import { HolidayItems } from '@/lib/events/halloween/claimItems.js';
import { LAUNCH_FOUNDER_BADGE } from '@/lib/events/launch/constants.js';
import { buildFounderLaunchExtras } from '@/lib/events/launch/launchBox.js';
import { isEventActive } from '@/lib/events/registry.js';
import { getReclaimableItemsOfUser } from '@/lib/reclaimableItems.js';

const independenceDay2Box = 'Independence Day 2 Box';

/** Free T1 Perks requirements. */
const FREE_T1_CL_PERCENT = 80;
const FREE_T1_XP = 500_000_000;
const FREE_T1_XP_SKILLS = 7;
const FREE_T1_LEVEL = 120;

/** One-time launch starter kit, given with the Founder claim (once per account). */
const LAUNCH_STARTER_KIT = new Bank()
	.add('Coins', 5_000_000)
	.add('Shark', 200)
	.add('Prayer potion(4)', 50)
	.add('Air rune', 2000)
	.add('Fire rune', 1000)
	.add('Law rune', 500)
	.add('Nature rune', 500)
	.freeze();
const independenceDay2EndDate = new Date('2026-07-20T00:00:00.000Z');

function maxIndy2Boxes(user: MUser): number {
	let maxBoxes = 1;

	const clPercent = calcCLDetails(user).percent;
	const accountAge = user.accountAgeInDays();
	const legitTriggers = [
		accountAge && accountAge >= 30,
		user.totalLevel >= 300,
		user.bitfield.includes(BitField.BSCEarlySupporter),
		user.bitfield.includes(BitField.BypassAgeRestriction),
		user.perkTier >= 3
	];
	const authorized = legitTriggers.some(Boolean);

	if (!authorized) {
		return 0;
	}

	const fiveYearAccount = accountAge && accountAge > 365 * 5;
	const ninetyPercentCl = clPercent >= 92;
	if (fiveYearAccount) {
		maxBoxes++;
	}
	if (ninetyPercentCl) {
		maxBoxes++;
	}
	return maxBoxes;
}

const claimables = [
	{
		name: 'Supporter cosmetic',
		hasRequirement: async () => true,
		action: async (user: MUser) => claimBscSupporterCosmetic(user)
	},
	{
		name: 'Founder',
		hasRequirement: async (user: MUser): Promise<true | string> => {
			if (user.bitfield.includes(BitField.LaunchFounder)) return true;
			if (!isEventActive('launch')) {
				return 'The Launch event is on hold. The Founder title can only be claimed while it is active.';
			}
			return true;
		},
		action: async (user: MUser) => {
			if (user.bitfield.includes(BitField.LaunchFounder)) {
				return `You already have the Founder title ${LAUNCH_FOUNDER_BADGE}.`;
			}
			await user.update({
				bitfield: {
					push: BitField.LaunchFounder
				}
			});
			const kit = new Bank().add(LAUNCH_STARTER_KIT).add(buildFounderLaunchExtras({ randInt }));
			await user.transactItems({ itemsToAdd: kit });
			return `You claimed the Founder title ${LAUNCH_FOUNDER_BADGE}. It stays on your name after the Launch event ends.\nYour launch starter kit is in your bank: ${kit}`;
		}
	},
	{
		name: independenceDay2Box,
		hasRequirement: async (user: MUser): Promise<true | string> => {
			if (BOT_TYPE !== 'BSO') {
				return 'This can only be claimed on Bark School Corgo.';
			}
			if (Date.now() >= independenceDay2EndDate.getTime()) {
				return 'This event is no longer claimable.';
			}

			const maxBoxes = maxIndy2Boxes(user);
			if (maxBoxes === 0) {
				return `You need to be at least 30 days old to claim this. If you think this is a mistake, please ask a mod to fix your 'minion buy date', or bypass the age restriction.`;
			}
			if (user.cl.amount(independenceDay2Box) >= maxBoxes) {
				return `You already claimed ${new Bank().add(independenceDay2Box, maxBoxes).toString()}.`;
			}
			return true;
		},
		action: async (user: MUser) => {
			const maxBoxes = maxIndy2Boxes(user);
			const boxesReceived = user.cl.amount(independenceDay2Box);
			const boxesRemaining = maxBoxes - boxesReceived;
			if (boxesRemaining <= 0) {
				return `Report to <@425134194436341760> for immediate punishment... I mean **fun**ishment...`;
			}
			const loot = new Bank().add(independenceDay2Box, boxesRemaining);
			await user.addItemsToBank({ items: loot, collectionLog: true });
			return `You claimed ${loot}.`;
		}
	},
	{
		name: 'Free T1 Perks',
		hasRequirement: async (user: MUser): Promise<true | string> => {
			const clPercent = calcCLDetails(user).percent;
			const levels = Object.values(user.skillsAsLevels);
			const skillsAt120 = levels.filter(lvl => lvl >= FREE_T1_LEVEL).length;
			const skillsAt500m = Object.values(user.skillsAsXP).filter(xp => xp >= FREE_T1_XP).length;
			const missing: string[] = [];
			if (clPercent < FREE_T1_CL_PERCENT) {
				missing.push(`${FREE_T1_CL_PERCENT}% collection log (you have ${clPercent.toFixed(1)}%)`);
			}
			if (skillsAt500m < FREE_T1_XP_SKILLS) {
				missing.push(`500m XP in ${FREE_T1_XP_SKILLS} skills (you have ${skillsAt500m})`);
			}
			if (skillsAt120 < levels.length) {
				missing.push(`level ${FREE_T1_LEVEL} in every skill (you have ${skillsAt120}/${levels.length})`);
			}
			if (missing.length === 0) return true;
			return `To claim free tier 1 perks you need: ${missing.join(', ')}.`;
		},
		action: async (user: MUser) => {
			if (user.bitfield.includes(BitField.BothBotsMaxedFreeTierOnePerks)) {
				return 'You already claimed this!';
			}
			globalClient.sendMessage(Channel.Notifications, {
				content: `${user.mention} just claimed free tier 1 perks for maxing their account!`
			});
			await user.update({
				bitfield: {
					push: BitField.BothBotsMaxedFreeTierOnePerks
				}
			});
			return 'You claimed free tier 1 perks on Bark School Corgo for maxing your account.';
		}
	},
	{
		name: `Halloween Items`,
		action: async (user: MUser) => {
			const holdMessage = halloweenClaimHoldMessage();
			if (holdMessage) return holdMessage;
			if (BOT_TYPE === 'BSO') {
				return 'This command is only for Bark School Corgo.';
			}
			const messages: string[] = [];
			const allItemsCanGet = [...HolidayItems.Halloween.halloweenItems];
			const isPermIron = user.isIronman && user.bitfield.includes(BitField.PermanentIronman);
			if (isPermIron) {
				allItemsCanGet.push(...HolidayItems.Halloween.halloweenOnlyForPermIrons);
				messages.push('As a permanent ironman, you are eligible for extra Halloween items!');
			}
			const ownedItems = user.allItemsOwned;
			const itemsToAdd = new Bank();
			for (const item of allItemsCanGet) {
				if (!ownedItems.has(item)) {
					itemsToAdd.add(item);
				}
			}

			if (itemsToAdd.length === 0) {
				return `You already have all Halloween items.`;
			}
			await user.transactItems({ itemsToAdd, collectionLog: true });
			messages.push(
				`You have claimed the following Halloween items: ${itemsToAdd.itemIDs
					.sort((a, b) => b - a)
					.map(id => Items.itemNameFromId(id))
					.join(', ')}.`
			);
			return new MessageBuilder().setContent(messages.join('')).addBankImage({
				bank: itemsToAdd,
				title: `Halloween Items Claimed`,
				user,
				flags: { forceAllPurple: 1 }
			});
		}
	},
	...CollectionLog.ranks.map(rank => ({
		name: `${rank.rank} Collection Log Rank`,
		hasRequirement: async (user: MUser): Promise<true | string> => {
			const { owned } = calcCLDetails(user);
			if (owned.length >= rank.itemsLogged) {
				return true;
			}
			return `You need to have logged at least ${rank.itemsLogged} items in your collection log to claim the ${rank.rank} rank. You currently have ${owned.length}.`;
		},
		action: async (user: MUser) => {
			const items = new Bank();

			if (user.allItemsOwned.amount(rank.book) < 3) {
				items.add(rank.book);
			}

			if (user.allItemsOwned.amount(rank.staff) < 3) {
				items.add(rank.staff);
			}
			if (items.length === 0) {
				return `You already have the ${rank.rank} rank items.`;
			}
			await user.addItemsToBank({ items, collectionLog: true });
			return `Congratulations! You claimed the ${rank.rank} Collection Log Rank and received: ${items}`;
		}
	}))
];

export const claimCommand = defineCommand({
	name: 'claim',
	description: 'Claim prizes, rewards and other things.',
	options: [
		{
			type: 'String',
			name: 'name',
			description: 'The thing you want to claim.',
			required: true,
			autocomplete: async ({ userId, value }: StringAutoComplete) => {
				const claimableItems = await prisma.reclaimableItem.findMany({
					where: {
						user_id: userId
					}
				});
				return [...claimables, ...claimableItems]
					.filter(i => (!value ? true : i.name.toLowerCase().includes(value.toLowerCase())))
					.map(i => ({
						name: i.name,
						value: i.name
					}));
			}
		}
	],
	run: async ({ options, user }) => {
		const claimable = claimables.find(i => stringMatches(i.name, options.name));
		if (!claimable) {
			const reclaimableData = await getReclaimableItemsOfUser(user);
			const rawData = reclaimableData.raw.find(i => i.name === options.name);
			if (!rawData) {
				return 'You are not eligible for this item.';
			}
			if (!reclaimableData.totalCanClaim.has(rawData.item_id)) {
				return 'You already claimed this item. If you lose it, you can reclaim it.';
			}
			const item = Items.getOrThrow(rawData.item_id);
			const loot = new Bank().add(item.id);
			await user.addItemsToBank({ items: loot, collectionLog: false });
			return `You claimed ${loot}.

${rawData.name}: ${rawData.description}.
${dateFm(new Date(rawData.date))}`;
		}

		if ('hasRequirement' in claimable && claimable.hasRequirement) {
			const requirementCheck = await claimable.hasRequirement(user);
			if (typeof requirementCheck === 'string') {
				return `You are not eligible to claim this: ${requirementCheck}`;
			}
		}

		const result = await claimable.action(user);
		return result;
	}
});
