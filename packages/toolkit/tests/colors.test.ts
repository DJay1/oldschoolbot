import { describe, expect, test } from 'vitest';

import { hexToDecimal, isValidHexColor } from '../src/colors.js';

describe('hexToDecimal', () => {
	test('converts hex colours with or without a #', () => {
		expect(hexToDecimal('#00FF66')).toBe(0x00ff66);
		expect(hexToDecimal('00ff66')).toBe(0x00ff66);
		expect(hexToDecimal('#AC7FFF')).toBe(0xac7fff);
		expect(hexToDecimal('#fff')).toBe(0xffffff);
	});

	test('throws on invalid colours', () => {
		expect(() => hexToDecimal('#GGGGGG')).toThrow('Invalid hex');
		expect(() => hexToDecimal('#12345')).toThrow('Invalid hex');
		expect(() => hexToDecimal('')).toThrow('Invalid hex');
	});

	test('every colour isValidHexColor accepts can be converted', () => {
		for (const hex of ['#4E42F5', '#000000', '#FFFFFF', '#ac7fff']) {
			expect(isValidHexColor(hex)).toBe(true);
			expect(() => hexToDecimal(hex)).not.toThrow();
		}
	});
});
