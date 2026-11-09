import { PLACEHOLDER_ITEM_IDS, placeholderName } from '@/lib/bso/bankPlaceholders.js';

import { Items } from 'oldschooljs';

import { setCustomItem, UN_EQUIPPABLE } from '@/lib/customItems/util.js';

for (const [i, id] of PLACEHOLDER_ITEM_IDS.entries()) {
	setCustomItem(id, placeholderName(i + 1), 'Coal', {
		tradeable: false,
		tradeable_on_ge: false,
		...UN_EQUIPPABLE,
		customItemData: {
			isSuperUntradeable: true,
			cantDropFromMysteryBoxes: true
		}
	});
	Items.getOrThrow(id).price = 0;
}
