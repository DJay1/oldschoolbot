import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { BitField } from '@/lib/constants.js';

/** Fragment item ID -> the bit set when the player breaks it with /use. */
export const TFA_FRAGMENT_BITS: [number, BitField][] = [
	[TfaItem.FRAGMENT_WIND, BitField.UsedFragmentOfWhisperingWind],
	[TfaItem.FRAGMENT_WATER, BitField.UsedFragmentOfDeepWater],
	[TfaItem.FRAGMENT_EARTH, BitField.UsedFragmentOfLivingEarth],
	[TfaItem.FRAGMENT_FIRE, BitField.UsedFragmentOfBurningFire]
];

export function tfaFragmentsUsed(user: { bitfield: readonly number[] }) {
	return TFA_FRAGMENT_BITS.filter(([, bit]) => user.bitfield.includes(bit)).length;
}
