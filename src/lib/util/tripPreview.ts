import { EmbedBuilder } from '@oldschoolgg/discord';
import { formatDuration } from '@oldschoolgg/toolkit';
import type { Bank } from 'oldschooljs';

const FIELD_LIMIT = 1024;

function bulletList(lines: string[]): string {
	const text = lines.map(line => `• ${line}`).join('\n');
	return text.length > FIELD_LIMIT ? `${text.slice(0, FIELD_LIMIT - 3)}...` : text;
}

function isPenalty(line: string): boolean {
	return line.startsWith('-') || line.toLowerCase().includes('penalty');
}

export function formatTripPreview({
	user,
	name,
	quantity,
	duration,
	stats = [],
	boosts = [],
	missedBoosts = [],
	cost,
	supplies = [],
	warning
}: {
	user: MUser;
	name: string;
	quantity: number;
	duration: number;
	stats?: string[];
	boosts?: string[];
	missedBoosts?: string[];
	cost?: Bank;
	supplies?: string[];
	warning?: string;
}) {
	const cleaned = boosts.map(line => line.replace(/\*\*Boosts:\*\*\s*/g, '').replace(/\.$/, '')).filter(Boolean);
	const positive = cleaned.filter(line => !isPenalty(line));
	const penalties = cleaned.filter(isPenalty).map(line => line.replace(/^-/, ''));

	const description = [
		...(warning ? [`⚠️ ${warning}`, ''] : []),
		`You can do **${quantity.toLocaleString()}x** in **${formatDuration(duration)}** (${formatDuration(duration / Math.max(1, quantity))} each).`,
		...stats
	];

	const embed = new EmbedBuilder().setTitle(name).setDescription(description.join('\n'));
	if (positive.length > 0) embed.addFields({ name: 'Boosts', value: bulletList(positive) });
	if (penalties.length > 0) embed.addFields({ name: 'Penalties', value: bulletList(penalties) });
	if (missedBoosts.length > 0) embed.addFields({ name: 'Missed boosts', value: bulletList(missedBoosts) });

	const supplyLines = [...supplies];
	if (cost && cost.length > 0) {
		supplyLines.unshift(cost.toString());
		if (!user.owns(cost)) supplyLines.push(`Missing: ${cost.clone().remove(user.allItemsOwned)}`);
	}
	if (supplyLines.length > 0) embed.addFields({ name: 'Supplies for a full trip', value: bulletList(supplyLines) });

	return { embeds: [embed] };
}
