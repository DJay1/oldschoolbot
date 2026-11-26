import { describe, expect, it } from 'vitest';

import './setup.js';

import { inventionMaterialsWipeData } from '@/mahoji/commands/testpotato.js';

describe('/testpotato reset Everything/All invention materials', () => {
	it('clears owned and researched invention materials', () => {
		expect(inventionMaterialsWipeData()).toEqual({
			materials_owned: {},
			researched_materials_bank: {}
		});
	});
});
