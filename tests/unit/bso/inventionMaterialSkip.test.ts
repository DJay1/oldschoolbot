import {
	formatInventionMaterialSkipConfirm,
	formatInventionMaterialSkipLine,
	formatInventionUsageCostLine,
	formatNeededVsOwned,
	INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX,
	INVENTION_MATERIAL_SKIP_CONFIRM_LABEL,
	INVENTION_MATERIAL_SKIP_CONFIRM_SUFFIX,
	INVENTION_MATERIAL_SKIP_CONFIRM_TIMEOUT_MS,
	type InventionMaterialSkip,
	shouldPromptInventionMaterialSkipConfirm
} from '@/lib/bso/skills/invention/inventionBoostNotice.js';
import { Inventions } from '@/lib/bso/skills/invention/inventions.js';
import { MaterialBank } from '@/lib/bso/skills/invention/MaterialBank.js';

import { describe, expect, test } from 'vitest';

import { BitField } from '@/lib/constants.js';

const DISCORD_MESSAGE_LIMIT = 2000;
const DISCORD_BUTTON_LABEL_LIMIT = 80;
const LENGTH_BUFFER = 150;

function skipFor(
	inventionName: string,
	cost: Record<string, number>,
	owned: Record<string, number>
): InventionMaterialSkip {
	return {
		inventionName,
		materialCost: new MaterialBank(cost),
		materialsOwned: new MaterialBank(owned)
	};
}

describe('invention material skip notice', () => {
	test('skip line names the invention', () => {
		expect(formatInventionMaterialSkipLine('Mecha rod')).toEqual('⚠️ Mecha rod skipped: not enough materials');
		expect(formatInventionMaterialSkipLine('Drygore axe')).toEqual('⚠️ Drygore axe skipped: not enough materials');
	});

	test('needed vs owned uses the required material types', () => {
		const skip = skipFor(
			'Mecha rod',
			{ flexible: 48, organic: 48, strong: 24 },
			{ flexible: 10, organic: 2154, strong: 5 }
		);
		expect(formatNeededVsOwned(skip)).toEqual(
			'Need 48x Flexible, 48x Organic, 24x Strong. You have 10x Flexible, 2,154x Organic, 5x Strong.'
		);
	});

	test('first-time confirm copy, button label and timeout', () => {
		const confirm = formatInventionMaterialSkipConfirm([
			skipFor('Mecha rod', { flexible: 48, organic: 48, strong: 24 }, { flexible: 10, strong: 5 })
		]);
		expect(confirm.confirmLabel).toEqual(INVENTION_MATERIAL_SKIP_CONFIRM_LABEL);
		expect(confirm.confirmLabel.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
		expect(confirm.timeout).toEqual(INVENTION_MATERIAL_SKIP_CONFIRM_TIMEOUT_MS);
		expect(confirm.content).toContain('⚠️ Mecha rod skipped: not enough materials.');
		expect(confirm.content).toContain('Need 48x Flexible, 48x Organic, 24x Strong.');
		expect(confirm.content).toContain('You have 10x Flexible, 0x Organic, 5x Strong.');
		expect(confirm.content).toContain('Start the trip without this boost?');
		expect(confirm.content).not.toContain('@');
	});

	test('one confirm can list more than one skipped invention', () => {
		const confirm = formatInventionMaterialSkipConfirm([
			skipFor('Quick trap', { flexible: 10 }, { flexible: 1 }),
			skipFor('Webshooter', { organic: 10 }, { organic: 1 })
		]);
		expect(confirm.content).toContain('⚠️ Invention boosts skipped: not enough materials.');
		expect(confirm.content).toContain('**Quick trap**');
		expect(confirm.content).toContain('**Webshooter**');
		expect(confirm.content).toContain('Start the trip without these boosts?');
	});

	test('confirm message worst case stays under Discord limits', () => {
		const usageInventions = Inventions.filter(i => i.usageCostMultiplier !== null);
		expect(usageInventions.length).toBeGreaterThan(5);
		const skips = usageInventions.map(invention => {
			const cost = new MaterialBank();
			const owned = new MaterialBank();
			for (const { type, quantity } of invention.materialTypeBank.values()) {
				cost.add(type, quantity * 1000);
				owned.add(type, 1);
			}
			return {
				inventionName: invention.item.name,
				materialCost: cost,
				materialsOwned: owned
			};
		});
		const confirm = formatInventionMaterialSkipConfirm(skips);
		const withTimeoutNote = `${confirm.content}${INVENTION_MATERIAL_SKIP_CONFIRM_SUFFIX}`;
		expect(confirm.confirmLabel.length).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_LIMIT);
		expect(confirm.content.length).toBeLessThanOrEqual(INVENTION_MATERIAL_SKIP_CONFIRM_CONTENT_MAX);
		expect(withTimeoutNote.length).toBeLessThanOrEqual(DISCORD_MESSAGE_LIMIT - LENGTH_BUFFER);
		expect(confirm.content.startsWith('⚠️')).toBe(true);
		for (const invention of usageInventions) {
			expect(formatInventionMaterialSkipLine(invention.item.name).length).toBeLessThanOrEqual(
				DISCORD_MESSAGE_LIMIT - LENGTH_BUFFER
			);
		}
	});

	test('prompt only on the first interactive slash start, never queued or after it was seen', () => {
		expect(
			shouldPromptInventionMaterialSkipConfirm({
				hasSeenConfirm: false,
				isInteractiveSlashStart: true,
				isQueued: false
			})
		).toBe(true);
		expect(
			shouldPromptInventionMaterialSkipConfirm({
				hasSeenConfirm: true,
				isInteractiveSlashStart: true,
				isQueued: false
			})
		).toBe(false);
		expect(
			shouldPromptInventionMaterialSkipConfirm({
				hasSeenConfirm: false,
				isInteractiveSlashStart: false,
				isQueued: false
			})
		).toBe(false);
		expect(
			shouldPromptInventionMaterialSkipConfirm({
				hasSeenConfirm: false,
				isInteractiveSlashStart: true,
				isQueued: true
			})
		).toBe(false);
	});

	test('usage cost details line follows the invention multiplier', () => {
		expect(formatInventionUsageCostLine(0.7)).toEqual('Charged per 3 minutes of trip x 0.7 usage');
		expect(formatInventionUsageCostLine(null)).toBeNull();
		const mecha = Inventions.find(i => i.item.name === 'Mecha rod');
		expect(mecha).toBeTruthy();
		expect(formatInventionUsageCostLine(mecha!.usageCostMultiplier)).toEqual(
			'Charged per 3 minutes of trip x 0.7 usage'
		);
	});

	test('seen-confirm flag is a new bitfield with no schema change', () => {
		expect(BitField.HasSeenInventionMaterialSkipConfirm).toEqual(250);
	});
});
