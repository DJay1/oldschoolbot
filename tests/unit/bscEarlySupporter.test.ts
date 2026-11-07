import { cleanString, Emoji } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { bitfieldCanUserManipulate, getBitFieldData } from '@/lib/bitFieldUtils.js';
import { BadgesEnum, BitField, BitFieldData, badges, globalConfig } from '@/lib/constants.js';
import { makeBadgeString } from '@/lib/util/makeBadgeString.js';
import { mockMUser } from './userutil.js';

describe('BSC Early Supporter', () => {
	test('bit 199 is granted by name through the admin bitfield option', () => {
		expect(BitField.BSCEarlySupporter).toBe(199);
		expect(BitFieldData[BitField.BSCEarlySupporter]).toEqual({
			name: 'BSC Early Supporter',
			protected: false,
			userConfigurable: false
		});

		const choice = Object.entries(BitFieldData)
			.filter(
				([, data]) => !data.protected && cleanString(data.name).includes(cleanString('BSC Early Supporter'))
			)
			.map(([value, data]) => ({ name: data.name, value }))
			.find(entry => entry.name === 'BSC Early Supporter');
		expect(choice).toEqual({ name: 'BSC Early Supporter', value: '199' });

		const bit = getBitFieldData(choice?.value ?? '');
		expect(bit).toEqual({
			bit: BitField.BSCEarlySupporter,
			data: BitFieldData[BitField.BSCEarlySupporter]
		});
		if (!bit) return;

		const admin = mockMUser({ id: globalConfig.adminUserIDs[0] });
		expect(bitfieldCanUserManipulate({ user: admin, bit })).toBe(true);

		const configurableNames = Object.values(BitFieldData)
			.filter(data => data.userConfigurable)
			.map(data => data.name);
		expect(configurableNames).not.toContain('BSC Early Supporter');
	});

	test('retired badge 17 does not render and the corgi comes from the bit', () => {
		expect(Object.values(BadgesEnum)).not.toContain(17);
		expect(Object.keys(BadgesEnum)).not.toContain('BSCEarlySupporter');
		expect(badges[17]).toBeUndefined();

		const staleOnly = makeBadgeString([17, BadgesEnum.Developer], false, false);
		expect(staleOnly).toBe(Emoji.Spanner);
		expect(staleOnly).not.toContain('undefined');

		const withBit = makeBadgeString([17], true, true);
		expect(withBit).toBe(`${Emoji.EsbCorgi} ${Emoji.Ironman}`);
		expect(withBit).not.toContain('undefined');
	});
});
