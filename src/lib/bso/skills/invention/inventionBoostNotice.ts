import type { MaterialBank } from '@/lib/bso/skills/invention/MaterialBank.js';

import { formatDuration, toTitleCase } from '@oldschoolgg/toolkit';

import { BitField } from '@/lib/constants.js';
import { getCommandInvokeContext, isInteractiveSlashCommandStart } from '@/lib/util/commandInvokeContext.js';
import { isQueuedTripStart } from '@/lib/util/tripLength.js';

export const INVENTION_MATERIAL_SKIP_CONFIRM_LABEL = 'Start anyway';
export const INVENTION_MATERIAL_SKIP_CONFIRM_TIMEOUT_MS = 30_000;

export interface InventionMaterialSkip {
	inventionName: string;
	materialCost: MaterialBank;
	materialsOwned: MaterialBank;
}

export function formatMaterialAmounts(bank: MaterialBank, types: string[]): string {
	return types.map(type => `${bank.amount(type as any).toLocaleString()}x ${toTitleCase(type)}`).join(', ');
}

export function formatNeededVsOwned(skip: InventionMaterialSkip): string {
	const types = skip.materialCost.values().map(v => v.type);
	return `Need ${skip.materialCost.toString()}. You have ${formatMaterialAmounts(skip.materialsOwned, types)}.`;
}

export function formatInventionMaterialShortfall(cost: MaterialBank, owned: MaterialBank): string | null {
	const parts: string[] = [];
	const types = cost
		.values()
		.map(v => v.type)
		.sort((a, b) => a.localeCompare(b));
	for (const type of types) {
		const short = cost.amount(type) - owned.amount(type);
		if (short > 0) {
			parts.push(`${short.toLocaleString()} more ${toTitleCase(type)}`);
		}
	}
	return parts.length > 0 ? parts.join(', ') : null;
}

export function formatInventionMaterialSkipLine(skip: InventionMaterialSkip): string {
	const base = `⚠️ ${skip.inventionName} skipped: not enough materials`;
	const shortfall = formatInventionMaterialShortfall(skip.materialCost, skip.materialsOwned);
	return shortfall ? `${base} (need ${shortfall}).` : `${base}.`;
}

/** "You have 30 seconds to confirm." plus the blank line confirmation.ts appends. */
export const INVENTION_MATERIAL_SKIP_CONFIRM_SUFFIX = `\n\nYou have ${Math.floor(INVENTION_MATERIAL_SKIP_CONFIRM_TIMEOUT_MS / 1000)} seconds to confirm.`;
export const INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX = 2000 - 150 - INVENTION_MATERIAL_SKIP_CONFIRM_SUFFIX.length;

export function formatInventionMaterialSkipConfirm(skips: InventionMaterialSkip[]): {
	content: string;
	confirmLabel: string;
	timeout: number;
} {
	const header =
		skips.length === 1
			? formatInventionMaterialSkipLine(skips[0])
			: '⚠️ Invention boosts skipped: not enough materials.';
	const question = skips.length === 1 ? 'Start the trip without this boost?' : 'Start the trip without these boosts?';
	const detailLine = (skip: InventionMaterialSkip) =>
		skips.length === 1 ? formatNeededVsOwned(skip) : `**${skip.inventionName}** — ${formatNeededVsOwned(skip)}`;
	const moreLine = (count: number) => `and ${count} more. Use /invention materials to check what you have.`;

	const build = (lines: string[], remaining: number) => {
		const extra = remaining > 0 ? `\n${moreLine(remaining)}` : '';
		return `${header}\n\n${lines.join('\n')}${extra}\n\n${question}`;
	};

	const lines: string[] = [];
	let content = build(skips.map(detailLine), 0);
	if (content.length > INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX) {
		for (let i = 0; i < skips.length; i++) {
			const candidate = build([...lines, detailLine(skips[i])], skips.length - i - 1);
			if (candidate.length > INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX) {
				content =
					lines.length > 0
						? build(lines, skips.length - lines.length)
						: build([skips.map(skip => skip.inventionName).join(', ')], 0);
				break;
			}
			lines.push(detailLine(skips[i]));
			content = candidate;
		}
	}

	if (content.length > INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX) {
		content = content.slice(0, INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX);
	}

	return {
		content,
		confirmLabel: INVENTION_MATERIAL_SKIP_CONFIRM_LABEL,
		timeout: INVENTION_MATERIAL_SKIP_CONFIRM_TIMEOUT_MS
	};
}

export function shouldPromptInventionMaterialSkipConfirm(opts: {
	hasSeenConfirm: boolean;
	isInteractiveSlashStart: boolean;
	isQueued: boolean;
}): boolean {
	return opts.isInteractiveSlashStart && !opts.isQueued && !opts.hasSeenConfirm;
}

export function userShouldPromptInventionMaterialSkipConfirm(user: { bitfield: readonly number[] }): boolean {
	return shouldPromptInventionMaterialSkipConfirm({
		hasSeenConfirm: user.bitfield.includes(BitField.HasSeenInventionMaterialSkipConfirm),
		isInteractiveSlashStart: isInteractiveSlashCommandStart(),
		isQueued: isQueuedTripStart()
	});
}

export async function markInventionMaterialSkipConfirmSeen(user: MUser): Promise<void> {
	if (user.bitfield.includes(BitField.HasSeenInventionMaterialSkipConfirm)) return;
	await user.update({
		bitfield: [...user.bitfield, BitField.HasSeenInventionMaterialSkipConfirm]
	});
}

/**
 * First time a usage-cost invention is skipped for missing materials on an
 * interactive slash command, ask once (Start anyway / Cancel). Cancel throws
 * SILENT_ERROR and does not start the trip. After the player proceeds once,
 * later skips only get the short boost-line notice.
 */
export async function confirmInventionMaterialSkips(user: MUser, skips: InventionMaterialSkip[]): Promise<void> {
	if (skips.length === 0) return;
	if (!userShouldPromptInventionMaterialSkipConfirm(user)) return;

	const interaction = getCommandInvokeContext()?.interaction;
	if (!interaction) return;

	const confirm = formatInventionMaterialSkipConfirm(skips);
	await interaction.confirmation({
		content: confirm.content,
		confirmLabel: confirm.confirmLabel,
		timeout: confirm.timeout
	});
	await markInventionMaterialSkipConfirmSeen(user);
}
export function formatInventionUsageCostLine(usageCostMultiplier: number | null): string | null {
	if (usageCostMultiplier === null) return null;
	return `Charged per 3 minutes of trip x ${usageCostMultiplier} usage`;
}

export function formatInventionFullTripCostLine(durationMs: number, cost: MaterialBank): string {
	return `Full trip cost for your max trip of ${formatDuration(durationMs)}: ${cost.toString()}. Some activities have a longer max trip, which costs more.`;
}
