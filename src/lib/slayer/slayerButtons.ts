import { tearsOfGuthixIronmanReqs, tearsOfGuthixSkillReqs } from '@/lib/bso/commands/tearsOfGuthixCommand.js';

import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { getNextUTCReset } from '@oldschoolgg/toolkit';

import { BitField, CONSTANTS, PerkTier } from '@/lib/constants.js';
import { InteractionID } from '@/lib/InteractionID.js';
import { canShowAutoFarmButton } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import {
	makeAutoContractButton,
	makeAutoFarmButton,
	makeBirdHouseTripButton,
	makeClaimDailyButton,
	makeRepeatTripButton,
	makeTearsOfGuthixButton
} from '@/lib/util/interactions.js';
import { hasSkillReqs } from '@/lib/util/smallUtils.js';
import { isUsersDailyReady } from '@/mahoji/lib/abstracted_commands/dailyCommand.js';
import { canRunAutoContract } from '@/mahoji/lib/abstracted_commands/farmingContractCommand.js';

export const slayerActionButtons = [
	new ButtonBuilder({
		label: 'Autoslay (Saved)',
		style: ButtonStyle.Secondary,
		custom_id: InteractionID.Slayer.AutoSlaySaved
	}),
	new ButtonBuilder({
		label: 'Autoslay (Default)',
		style: ButtonStyle.Secondary,
		custom_id: InteractionID.Slayer.AutoSlayDefault
	}),
	new ButtonBuilder({
		label: 'Autoslay (EHP)',
		style: ButtonStyle.Secondary,
		custom_id: InteractionID.Slayer.AutoSlayEHP
	}),
	new ButtonBuilder({
		label: 'Autoslay (Boss)',
		style: ButtonStyle.Secondary,
		custom_id: InteractionID.Slayer.AutoSlayBoss
	}),
	new ButtonBuilder({
		label: 'Cancel Task + New (30 points)',
		style: ButtonStyle.Danger,
		custom_id: InteractionID.Slayer.SkipTask
	}),
	new ButtonBuilder({
		label: 'Block Task + New (100 points)',
		style: ButtonStyle.Danger,
		custom_id: InteractionID.Slayer.BlockTask
	})
];

/** Repeat trip and the usual perk-gated follow-ups, plus the slayer action buttons. */
export async function slayerTaskReturnButtons(user: MUser): Promise<ButtonBuilder[]> {
	const components: ButtonBuilder[] = [makeRepeatTripButton()];
	const perkTier = await user.fetchPerkTier();
	if (perkTier >= PerkTier.Two) {
		if (!user.bitfield.includes(BitField.DisableBirdhouseRunButton) && user.fetchBirdhouseData().isReady) {
			components.push(makeBirdHouseTripButton());
		}
		if (!user.bitfield.includes(BitField.DisableAutoFarmContractButton) && (await canRunAutoContract(user))) {
			components.push(makeAutoContractButton());
		}
		if (!user.bitfield.includes(BitField.DisableAutoFarmButton) && (await canShowAutoFarmButton(user))) {
			components.push(makeAutoFarmButton());
		}
		if (!user.bitfield.includes(BitField.DisableDailyButton) && (await isUsersDailyReady(user)).isReady) {
			components.push(makeClaimDailyButton());
		}
		if (!user.bitfield.includes(BitField.DisableTearsOfGuthixButton)) {
			const { last_tears_of_guthix_timestamp } = await user.fetchStats();
			const lastPlayedDate = Number(last_tears_of_guthix_timestamp);
			const nextReset = getNextUTCReset(lastPlayedDate, CONSTANTS.TEARS_OF_GUTHIX_CD);
			const ready = nextReset < Date.now();
			const meetsSkillReqs = hasSkillReqs(user, tearsOfGuthixSkillReqs)[0];
			const meetsIronmanReqs = user.user.minion_ironman ? hasSkillReqs(user, tearsOfGuthixIronmanReqs)[0] : true;
			if (user.QP >= 43 && ready && meetsSkillReqs && meetsIronmanReqs) {
				components.push(makeTearsOfGuthixButton());
			}
		}
	}
	components.push(...slayerActionButtons);
	return components;
}
