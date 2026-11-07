import { setCustomItem } from '@/lib/customItems/util.js';

/** Easter event item definitions. Always registered so owned eggs and pets still resolve. */
export function registerEasterItems() {
	setCustomItem(
		74_007,
		'The whale card',
		'Coal',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true,
				isDiscontinued: true
			}
		},
		1_000_000
	);

	setCustomItem(
		74_008,
		'Wubbles',
		'Herbi',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true,
				isDiscontinued: true
			}
		},
		1_000_000
	);
	setCustomItem(
		74_009,
		'Wubufu',
		'Herbi',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true,
				isDiscontinued: true
			}
		},
		1_000_000
	);
	setCustomItem(
		74_010,
		'Wabbit eggs',
		'Coal',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true
			}
		},
		1_000_000
	);
	setCustomItem(
		74_011,
		'Magnegg',
		'Herbi',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true
			}
		},
		1_000_000
	);
	setCustomItem(
		73_969,
		'Radiant Magnabbit',
		'Herbi',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true,
				isPet: true
			}
		},
		1_000_000
	);

	setCustomItem(
		74_012,
		'Magnabbit',
		'Herbi',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true
			}
		},
		1_000_000
	);
	setCustomItem(
		74_013,
		'The whale card (fake)',
		'Coal',
		{
			customItemData: {
				cantDropFromMysteryBoxes: true,
				isSuperUntradeable: true
			}
		},
		1_000_000
	);
}
