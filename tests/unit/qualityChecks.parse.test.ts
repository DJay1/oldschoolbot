import { describe, expect, test } from 'vitest';

import { QUALITY_CHECK_TAGS } from '@/lib/qualityChecks/config.js';
import {
	bountyStatusFromTagNames,
	isImageAttachment,
	latestClaimerId,
	matchBountyItem,
	parseQualityCheckButtonId,
	qualityCheckButtonCustomId
} from '@/lib/qualityChecks/parse.js';

describe('quality check bounty parsing', () => {
	test('locks tag names to the Guider set', () => {
		expect(QUALITY_CHECK_TAGS).toEqual(['open', 'claimed', 'needs-DJ', 'passed', 'failed']);
		expect(bountyStatusFromTagNames(['open', 'passed'])).toBe('passed');
		expect(bountyStatusFromTagNames(['needs-dj'])).toBeNull();
		expect(bountyStatusFromTagNames(['needs-DJ', 'claimed'])).toBe('needs-DJ');
	});

	test('matches a bounty from its marker or title', () => {
		expect(matchBountyItem('Please check\n[qc:item-hub]', 'something else')).toBe('item-hub');
		expect(matchBountyItem('no marker', 'Boss hub')).toBe('boss-hub');
		expect(matchBountyItem('[qc:help-placeholder] [qc:item-hub]', 'Boss hub')).toBeNull();
	});

	test('reads the latest claimer and screenshot attachments', () => {
		expect(latestClaimerId(['Claimed by <@111111111111111111>', 'Claimed by <@222222222222222222>'])).toBe(
			'222222222222222222'
		);
		expect(isImageAttachment({ content_type: 'image/png', filename: 'shot.png' })).toBe(true);
		expect(isImageAttachment({ filename: 'notes.txt' })).toBe(false);
	});

	test('round trips bounty buttons', () => {
		const id = qualityCheckButtonCustomId('confirm', 'pr1-branding-hubs', 'help-placeholder');
		expect(parseQualityCheckButtonId(id)).toEqual({
			action: 'confirm',
			campaignId: 'pr1-branding-hubs',
			itemId: 'help-placeholder'
		});
		expect(parseQualityCheckButtonId('QC:pass:pr1:help-placeholder')).toBeNull();
	});
});
