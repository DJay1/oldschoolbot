import { formatDuration } from '@oldschoolgg/toolkit';
import type { Bank } from 'oldschooljs';

export function formatTripPreview({
	user,
	name,
	quantity,
	duration,
	boosts = [],
	cost,
	notes = []
}: {
	user: MUser;
	name: string;
	quantity: number;
	duration: number;
	boosts?: string[];
	cost?: Bank;
	notes?: string[];
}): string {
	const lines = [
		`**${name}**`,
		'',
		'**Trip**',
		`You can do **${quantity}x** in ${formatDuration(duration)} (${formatDuration(duration / Math.max(1, quantity))} each).`,
		...notes
	];
	if (boosts.length > 0) lines.push('', '**Boosts**', boosts.join(', '));
	if (cost && cost.length > 0) {
		lines.push('', `**Supplies for a full trip:** ${cost}`);
		if (!user.owns(cost)) lines.push(`You're missing: ${cost.clone().remove(user.allItemsOwned)}`);
	}
	return lines.join('\n');
}
