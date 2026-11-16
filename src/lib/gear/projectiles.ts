import { resolveItems } from 'oldschooljs';

import { SEEKING_ARROWS } from '@/lib/customItems/bloodMoon.js';

const SEEKING_ARROW_BASES = ['Adamant arrow', 'Rune arrow', 'Amethyst arrow', 'Dragon arrow', 'Hellfire arrow'];

export const projectiles = {
	arrow: {
		items: [
			...resolveItems(['Adamant arrow', 'Rune arrow', 'Amethyst arrow', 'Dragon arrow', 'Hellfire arrow']),
			...SEEKING_ARROWS.filter(a => SEEKING_ARROW_BASES.includes(a.base)).map(a => a.id)
		],
		savedByAvas: true,
		weapons: resolveItems(['Twisted bow'])
	},
	ogreArrow: {
		items: resolveItems(['Ogre Arrow']),
		savedByAvas: true,
		weapons: resolveItems(['Ogre bow'])
	},
	bolt: {
		items: resolveItems([
			'Silver bolts',
			'Runite bolts',
			'Dragon bolts',
			'Diamond bolts (e)',
			'Diamond dragon bolts (e)',
			'Ruby dragon bolts (e)'
		]),
		savedByAvas: true,
		weapons: resolveItems([
			'Armadyl crossbow',
			'Dragon hunter crossbow',
			'Dragon crossbow',
			'Zaryte crossbow',
			'Rune crossbow'
		])
	},
	// The Fractured Archive: only the Ascension crossbows (74603) can fire these, and they fire nothing else.
	// 74620-74624: Ascension bolts, Diamond/Onyx ascension bolts and their (e) versions.
	ascensionBolt: {
		items: resolveItems([74_620, 74_621, 74_622, 74_623, 74_624]),
		savedByAvas: true,
		weapons: resolveItems([74_603])
	},
	javelin: {
		items: resolveItems(['Amethyst javelin', 'Rune javelin', 'Dragon javelin', 'Obsidian javelin']),
		savedByAvas: false,
		weapons: resolveItems(['Heavy ballista'])
	}
} as const;
export type ProjectileType = keyof typeof projectiles;
