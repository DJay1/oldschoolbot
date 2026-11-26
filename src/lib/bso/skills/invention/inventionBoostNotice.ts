import { MaterialBank } from '@/lib/bso/skills/invention/MaterialBank.js';

import { SpecialResponse } from '@oldschoolgg/discord';
import { formatDuration, toTitleCase } from '@oldschoolgg/toolkit';

import type { CommandResponseValue } from '@/discord/commands/commandTypes.js';
import { MessageBuilderClass } from '@/discord/MessageBuilder.js';
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

export function formatInventionMaterialSkipLine(inventionName: string): string {
	return `⚠️ ${inventionName} skipped: not enough materials`;
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
			? `⚠️ ${skips[0].inventionName} skipped: not enough materials.`
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

export const INVENTION_TRIP_TOTAL_PREFIX = 'Invention materials for this trip:';
const DISCORD_CONTENT_SAFE_MAX = 2000 - 150;

export function formatInventionTripMaterialTotal(cost: MaterialBank): string {
	return `${INVENTION_TRIP_TOTAL_PREFIX} ${cost.toString()}`;
}

export function recordInventionTripMaterialCost(cost: MaterialBank): void {
	if (cost.values().length === 0) return;
	const ctx = getCommandInvokeContext();
	if (!ctx) return;
	ctx.inventionMaterialsCharged ??= new MaterialBank();
	ctx.inventionMaterialsCharged.add(cost);
}

export function takeInventionTripMaterialTotal(user: { bitfield: readonly number[] }): string | null {
	if (!user.bitfield.includes(BitField.ShowInventionTripMaterials)) return null;
	const ctx = getCommandInvokeContext();
	const cost = ctx?.inventionMaterialsCharged;
	if (!cost || cost.values().length === 0) return null;
	ctx.inventionMaterialsCharged = new MaterialBank();
	return formatInventionTripMaterialTotal(cost);
}

export function appendInventionTripMaterialTotalToResponse(
	user: { bitfield: readonly number[] },
	response: CommandResponseValue
): CommandResponseValue {
	if (
		response === SpecialResponse.PaginatedMessageResponse ||
		response === SpecialResponse.SilentErrorResponse ||
		response === SpecialResponse.RespondedManually
	) {
		return response;
	}
	const line = takeInventionTripMaterialTotal(user);
	if (!line) return response;
	if (response instanceof MessageBuilderClass) {
		const current = response.message.content ?? '';
		if (current.length + 1 + line.length <= DISCORD_CONTENT_SAFE_MAX) {
			response.addContent(current.length > 0 ? `\n${line}` : line);
		}
		return response;
	}
	if (typeof response === 'string') {
		if (response.length + 1 + line.length <= DISCORD_CONTENT_SAFE_MAX) {
			return response.length > 0 ? `${response}\n${line}` : line;
		}
		return response;
	}
	if (response && typeof response === 'object' && 'content' in response) {
		const current = response.content ?? '';
		if (current.length + 1 + line.length <= DISCORD_CONTENT_SAFE_MAX) {
			return { ...response, content: current.length > 0 ? `${current}\n${line}` : line };
		}
	}
	return response;
}
