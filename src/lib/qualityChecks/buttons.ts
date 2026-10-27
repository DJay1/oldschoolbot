import { findQualityCheckItem, qualityCheckCampaign, qualityCheckConfig } from '@/lib/qualityChecks/config.js';
import { QualityCheckBoardError } from '@/lib/qualityChecks/forum.js';
import { parseQualityCheckButtonId } from '@/lib/qualityChecks/parse.js';
import {
	claimQualityCheckBounty,
	confirmQualityCheckBounty,
	rejectQualityCheckBounty,
	submitQualityCheckBounty
} from '@/lib/qualityChecks/service.js';

export async function handleQualityCheckButton(
	user: MUser,
	customId: string,
	interaction: OSInteraction
): CommandResponse {
	const parsed = parseQualityCheckButtonId(customId);
	if (!parsed) return { content: 'That bounty button is not valid.', ephemeral: true };
	if (interaction.guildId !== qualityCheckConfig.guildId || parsed.campaignId !== qualityCheckCampaign.id) {
		return { content: 'This bounty is for a different server.', ephemeral: true };
	}
	if (!findQualityCheckItem(parsed.itemId)) {
		return { content: 'That bounty is not part of the current campaign.', ephemeral: true };
	}
	const roles = interaction.member?.roles ?? [];
	await interaction.defer({ ephemeral: true });
	try {
		switch (parsed.action) {
			case 'claim':
				return { content: await claimQualityCheckBounty(user, parsed.itemId, roles), ephemeral: true };
			case 'done':
				return { content: await submitQualityCheckBounty(user, parsed.itemId, roles), ephemeral: true };
			case 'confirm':
				return { content: await confirmQualityCheckBounty(user, parsed.itemId), ephemeral: true };
			case 'reject':
				return { content: await rejectQualityCheckBounty(user, parsed.itemId), ephemeral: true };
		}
	} catch (err) {
		if (err instanceof QualityCheckBoardError) return { content: err.message, ephemeral: true };
		Logging.logError(err as Error, { type: 'QUALITY_CHECK_BUTTON', item_id: parsed.itemId });
		return { content: 'Could not update that bounty.', ephemeral: true };
	}
}
