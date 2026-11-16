import type { PrimaryGearSetupType } from '@oldschoolgg/gear';
import type { Monster } from 'oldschooljs';

import { tfaFragmentsUsed } from '@/lib/bsc/tfa/tfaFragments.js';
import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { BitField } from '@/lib/constants.js';
import type { GearBank } from '@/lib/structures/GearBank.js';

export interface TfaPvmBoost {
	percentageReduction: number;
	message: string;
}

/**
 * Normal PvM (k/kill) boosts from Fractured Archive rewards. These are BSC
 * adaptations of the OSRS effects, which need real combat mechanics:
 * - Zeal (unlocked with Horn of Bran, 84 Prayer): 3% when using melee.
 * - Elemental fragments (used with /use): 1% each when using magic.
 * - Obligator (uncharged): 8% against monsters weaker to crush than to both stab and slash,
 *   4% if weaker to crush than one of them (its extra damage rolls in OSRS).
 * - Zorya's tome (uncharged): 5% when using magic (its special attack).
 * - Ascension crossbows: 5% when using ranged (fast attack speed).
 */
export function tfaPvmBoosts({
	gearBank,
	primaryStyle,
	osjsMon,
	bitfield,
	isInWilderness
}: {
	gearBank: GearBank;
	primaryStyle: PrimaryGearSetupType;
	osjsMon: Monster | undefined;
	bitfield: readonly number[];
	isInWilderness: boolean;
}): TfaPvmBoost[] {
	const results: TfaPvmBoost[] = [];
	if (isInWilderness) return results;

	if (primaryStyle === 'melee' && bitfield.includes(BitField.HasZeal) && gearBank.skillsAsLevels.prayer >= 84) {
		results.push({ percentageReduction: 3, message: '3% for Zeal' });
	}

	if (primaryStyle === 'mage') {
		const fragments = tfaFragmentsUsed({ bitfield });
		if (fragments > 0) {
			results.push({ percentageReduction: fragments, message: `${fragments}% for elemental fragments` });
		}
		if (gearBank.gear.mage.hasEquipped(TfaItem.ZORYAS_TOME)) {
			results.push({ percentageReduction: 5, message: "5% for Zorya's tome" });
		}
	}

	if (primaryStyle === 'range' && gearBank.gear.range.hasEquipped(TfaItem.ASCENSION_CROSSBOWS)) {
		results.push({ percentageReduction: 5, message: '5% for Ascension crossbows' });
	}

	if (primaryStyle === 'melee' && gearBank.gear.melee.hasEquipped(TfaItem.OBLIGATOR) && osjsMon) {
		const { defenceCrush, defenceStab, defenceSlash } = osjsMon.data;
		const weaker = [defenceStab, defenceSlash].filter(d => d > defenceCrush).length;
		if (weaker > 0) {
			const pct = weaker === 2 ? 8 : 4;
			results.push({ percentageReduction: pct, message: `${pct}% for Obligator (crush weakness)` });
		}
	}

	return results;
}
