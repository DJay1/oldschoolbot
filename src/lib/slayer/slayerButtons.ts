import { tearsOfGuthixIronmanReqs, tearsOfGuthixSkillReqs } from '@/lib/bso/commands/tearsOfGuthixCommand.js';

import type { ButtonBuilder } from '@oldschoolgg/discord';
import { getNextUTCReset } from '@oldschoolgg/toolkit';

import { BitField, CONSTANTS, PerkTier } from '@/lib/constants.js';
import { canShowAutoFarmButton } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import { makeSlayerActionButtons } from '@/lib/slayer/slayerActionButtons.js';
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

/** Repeat trip and the usual perk-gated follow-ups, plus the slayer action buttons. */
export async function slayerTaskReturnButtons(
	user: MUser,
	actionButtons: ButtonBuilder[] = makeSlayerActionButtons(30, 100)
): Promise<ButtonBuilder[]> {
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
	components.push(...actionButtons);
	return components;
}
