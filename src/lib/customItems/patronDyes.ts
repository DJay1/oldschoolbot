import { setCustomItem } from '@/lib/customItems/util.js';

const untradeable = {
	tradeable: false,
	tradeable_on_ge: false,
	customItemData: {
		cantDropFromMysteryBoxes: true
	}
};

setCustomItem(74_014, 'Biscuit dye', 'Coal', untradeable, 1);
setCustomItem(74_015, 'Fetch dye', 'Coal', untradeable, 1);
setCustomItem(74_016, 'Pawberry dye', 'Coal', untradeable, 1);
setCustomItem(74_017, 'Midnight Pup dye', 'Coal', untradeable, 1);
setCustomItem(74_018, 'Golden Corgo dye', 'Coal', untradeable, 1);
