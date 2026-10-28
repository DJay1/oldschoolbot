import { ButtonBuilder, ButtonStyle, userMention } from '@oldschoolgg/discord';

import {
	type QualityCheckBountyStatus,
	type QualityCheckItem,
	qualityCheckCampaign
} from '@/lib/qualityChecks/config.js';
import { bountyMarker, cleanQualityCheckNote, qualityCheckButtonCustomId } from '@/lib/qualityChecks/parse.js';

export interface BountyView {
	status: QualityCheckBountyStatus;
	claimerId: string | null;
	reviewNote: string | null;
}

function button(action: 'claim' | 'done' | 'confirm' | 'reject', itemId: string, label: string, style: ButtonStyle) {
	return new ButtonBuilder()
		.setCustomId(qualityCheckButtonCustomId(action, qualityCheckCampaign.id, itemId))
		.setLabel(label)
		.setStyle(style);
}

export function bountyButtons(itemId: string, status: QualityCheckBountyStatus): ButtonBuilder[] {
	switch (status) {
		case 'open':
		case 'failed':
			return [button('claim', itemId, 'Claim', ButtonStyle.Primary)];
		case 'claimed':
			return [button('done', itemId, 'Done', ButtonStyle.Primary)];
		case 'needs-DJ':
			return [
				button('confirm', itemId, 'Confirm ✓', ButtonStyle.Success),
				button('reject', itemId, 'Reject ✗', ButtonStyle.Danger)
			];
		case 'passed':
			return [];
	}
}

export function renderBountyPost(
	item: QualityCheckItem,
	view: BountyView
): {
	content: string;
	buttons: ButtonBuilder[];
} {
	const lines = [
		`**${item.label}** (\`${item.id}\`)`,
		bountyMarker(item.id),
		'',
		item.instruction,
		'',
		'How to get credit:',
		'1. Click Claim.',
		'2. Do the check and upload a screenshot in this thread.',
		'3. Click Done. That pings DJ.',
		'Credit counts only after DJ clicks Confirm. Reject does not count.',
		'',
		`Tag: \`${view.status}\``
	];
	if (view.claimerId) lines.push(`Claimed by ${userMention(view.claimerId)}`);
	const note = cleanQualityCheckNote(view.reviewNote);
	if (view.status === 'failed' && note) lines.push(`Last reject: ${note}`);
	if (view.status === 'passed' && view.claimerId) {
		lines.push(`Credit recorded for ${userMention(view.claimerId)}.`);
	}
	return { content: lines.join('\n'), buttons: bountyButtons(item.id, view.status) };
}
