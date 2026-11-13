import { expect, test } from 'vitest';

import { formatPatronDyeShop } from '@/lib/bsc/patronDyeShop.js';
import {
	cachePatronDye,
	clearPatronDyeCache,
	PATRON_DYE_PREVIEW_NOTE,
	PATRON_DYES,
	parseHexColor,
	parsePatronDyeMode,
	patronDyeByKey,
	resolvePatronDyeAppearance
} from '@/lib/bsc/patronDyes.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';
import { isGEUntradeable } from '@/lib/bso/bsoUtil.js';

test('dyed item IDs stay tradeable because the dye is an account cosmetic', () => {
	clearPatronDyeCache();
	const userId = '123';
	const itemID = 4587; // Dragon scimitar
	expect(itemIsTradeable(itemID, true, userId)).toBe(true);

	cachePatronDye(userId, { itemID, dyeKey: 'golden', mode: 'recolour_glow' });
	expect(itemIsTradeable(itemID, true, userId)).toBe(true);
	expect(itemIsTradeable(itemID, true, 'someone-else')).toBe(true);
	expect(isGEUntradeable(itemID, userId)).toBe(false);
});

test('dye shop text covers tradeable dyes, dyeclaim, and preview', () => {
	const text = formatPatronDyeShop(12, [
		{ itemID: 11_832, dyeKey: 'fetch', mode: 'recolour_glow' }
	]);
	expect(text).toContain('dyed items stay tradeable');
	expect(text).toContain('/patron dyeclaim');
	expect(text).toContain('/patron dye_preview');
	expect(text.toLowerCase()).not.toContain('untradeable');
	expect(text).toContain('Bandos chestplate');
});

test('Golden Corgo preview note explains custom colours and sparkle', () => {
	expect(PATRON_DYE_PREVIEW_NOTE).toBe('Golden Corgo: any glow colour, any dye colour, sparkle on/off');
	expect(PATRON_DYES.some(dye => dye.customizable && dye.name === 'Golden Corgo')).toBe(true);
	expect(parsePatronDyeMode('recolor+glow')).toBe('recolour_glow');
	expect(parseHexColor('#ff00aa')).toBe('#FF00AA');
	expect(patronDyeByKey('golden corgo')?.customizable).toBe(true);
	expect(resolvePatronDyeAppearance({ itemID: 1, dyeKey: 'golden', mode: 'glow' })).toEqual({
		color: '#D4A017',
		glow: '#F5D76A',
		sparkles: false
	});
});
