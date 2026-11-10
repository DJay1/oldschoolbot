import { EquipmentSlot, type GearSetup, isValidGearSetup } from '@oldschoolgg/gear';
import { objectEntries, toTitleCase } from '@oldschoolgg/toolkit';
import type { Item } from 'oldschooljs';
import { Bank } from 'oldschooljs';

import { parseQuantityAndItem } from '@/lib/util/parseStringBank.js';
import { formatList } from '@/lib/util/smallUtils.js';

function splitItemInput(items: string): string[] {
	return items
		.trim()
		.replace(/\s\s+/g, ' ')
		.split(',')
		.map(part => part.trim())
		.filter(Boolean);
}

function missingSkillRequirementText(
	user: MUser,
	requirements: NonNullable<NonNullable<Item['equipment']>['requirements']>
): string | null {
	const missing: string[] = [];
	for (const [skillName, requiredLevel] of objectEntries(requirements)) {
		if (!requiredLevel) continue;
		const level = user.skillsAsRequirements[skillName] ?? 0;
		if (!level || level < requiredLevel) {
			missing.push(`${requiredLevel} ${toTitleCase(skillName)}`);
		}
	}
	if (missing.length === 0) return null;
	return formatList(missing);
}

function slotLabel(slot: EquipmentSlot): string {
	return slot === EquipmentSlot.TwoHanded ? 'two-handed' : slot;
}

export function formatGearEquipFailures(reasons: string[]): string {
	if (reasons.length === 0) return '';
	if (reasons.length === 1) return reasons[0];
	return reasons.map(reason => `- ${reason}`).join('\n');
}

export function gearEquipMultiImpl(
	user: MUser,
	setup: string,
	items: string
): {
	success: boolean;
	failMsg?: string;
	equipBank?: Bank;
	unequipBank?: Bank;
	skillFailBank?: Bank;
	failReasons?: string[];
	equippedGear?: GearSetup;
} {
	if (!isValidGearSetup(setup)) return { success: false, failMsg: 'Invalid gear setup' };

	const reservedSlots: Partial<Record<EquipmentSlot, Item>> = {};
	const failedToEquipBank = new Bank();
	const equipBank = new Bank();
	const failReasons: string[] = [];

	const parts = splitItemInput(items);
	if (parts.length === 0) {
		return { success: false, failMsg: "You didn't specify any items to equip.", failReasons: [] };
	}

	for (const raw of parts) {
		const parsed = parseQuantityAndItem(raw, user.bank);
		const resItems = parsed[0];
		const parsedQty = parsed[1];
		if (!resItems || resItems.length === 0) {
			failReasons.push(`Couldn't find an item named "${raw}".`);
			continue;
		}

		let item = resItems[0];
		if (resItems.length > 1) {
			const owned = resItems.find(candidate => user.bank.amount(candidate.id) > 0);
			if (owned) item = owned;
		}

		const qty = item.stackable ? parsedQty || 1 : 1;
		const ownedQty = user.bank.amount(item.id);
		if (ownedQty < qty) {
			if (ownedQty === 0) {
				failReasons.push(`You don't have ${item.name}.`);
			} else {
				failReasons.push(`You need ${qty}x ${item.name}, but you only have ${ownedQty}x.`);
			}
			continue;
		}

		if (!item.equipable || !item.equipment) {
			failReasons.push(`${item.name} isn't equippable.`);
			continue;
		}

		const { slot } = item.equipment;
		if (item.equipment.requirements) {
			const missing = missingSkillRequirementText(user, item.equipment.requirements);
			if (missing) {
				failedToEquipBank.add(item.id, qty);
				failReasons.push(`${item.name} needs ${missing}.`);
				continue;
			}
		}

		const twoHandedItem = reservedSlots[EquipmentSlot.TwoHanded];
		const weaponItem = reservedSlots[EquipmentSlot.Weapon];
		const shieldItem = reservedSlots[EquipmentSlot.Shield];
		if (slot === EquipmentSlot.TwoHanded && (weaponItem || shieldItem)) {
			const conflict = (weaponItem ?? shieldItem)!;
			failReasons.push(`${item.name} is two-handed, so it conflicts with ${conflict.name}.`);
			continue;
		}
		if ((slot === EquipmentSlot.Weapon || slot === EquipmentSlot.Shield) && twoHandedItem) {
			failReasons.push(`${item.name} conflicts with ${twoHandedItem.name}, which is two-handed.`);
			continue;
		}

		if (reservedSlots[slot]) {
			failReasons.push(
				`${item.name} couldn't be equipped because you already chose ${reservedSlots[slot]!.name} for the ${slotLabel(slot)} slot.`
			);
			continue;
		}

		reservedSlots[slot] = item;
		equipBank.add(item.id, qty);
	}

	const equippedGear = { ...user.gear[setup].raw() };

	const unequipBank = new Bank();

	for (const [item, qty] of equipBank.items()) {
		const { slot } = item.equipment!;
		if (slot === EquipmentSlot.TwoHanded && equippedGear[EquipmentSlot.Shield]) {
			unequipBank.add(equippedGear[EquipmentSlot.Shield]?.item, equippedGear[EquipmentSlot.Shield]?.quantity);
			equippedGear[EquipmentSlot.Shield] = null;
		}
		if (slot === EquipmentSlot.TwoHanded && equippedGear[EquipmentSlot.Weapon]) {
			unequipBank.add(equippedGear[EquipmentSlot.Weapon]?.item, equippedGear[EquipmentSlot.Weapon]?.quantity);
			equippedGear[EquipmentSlot.Weapon] = null;
		}
		if (equippedGear[EquipmentSlot.TwoHanded] && (slot === EquipmentSlot.Shield || slot === EquipmentSlot.Weapon)) {
			unequipBank.add(
				equippedGear[EquipmentSlot.TwoHanded]?.item,
				equippedGear[EquipmentSlot.TwoHanded]?.quantity
			);
			equippedGear[EquipmentSlot.TwoHanded] = null;
		}
		if (equippedGear[slot]) {
			unequipBank.add(equippedGear[slot]?.item, equippedGear[slot]?.quantity);
		}
		equippedGear[slot] = { item: item.id, quantity: qty };
	}
	return {
		success: true,
		equipBank,
		unequipBank,
		equippedGear,
		skillFailBank: failedToEquipBank,
		failReasons
	};
}
