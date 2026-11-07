import { setCustomItem } from '@/lib/customItems/util.js';

/** Halloween event item definitions. Always registered so owned cards still resolve. */
export function registerHalloweenItems() {
	setCustomItem(73_602, 'Death card', 'Coal', {
		customItemData: {
			cantDropFromMysteryBoxes: true,
			isSuperUntradeable: true
		}
	});

	setCustomItem(73_603, 'Pumpkinman card', 'Coal', {
		customItemData: {
			cantDropFromMysteryBoxes: true,
			isSuperUntradeable: true
		}
	});

	setCustomItem(73_604, 'Vampire card', 'Coal', {
		customItemData: {
			cantDropFromMysteryBoxes: true,
			isSuperUntradeable: true
		}
	});

	setCustomItem(73_605, 'Ghost card', 'Coal', {
		customItemData: {
			cantDropFromMysteryBoxes: true,
			isSuperUntradeable: true
		}
	});

	setCustomItem(73_606, 'Witch card', 'Coal', {
		customItemData: {
			cantDropFromMysteryBoxes: true,
			isSuperUntradeable: true
		}
	});

	setCustomItem(73_600, 'Halloween candy', 'Coal', {
		customItemData: {
			cantDropFromMysteryBoxes: true
		}
	});

	setCustomItem(73_601, 'Night-Mare', 'Herbi', {
		customItemData: {
			cantDropFromMysteryBoxes: true,
			isDiscontinued: true
		}
	});
}
