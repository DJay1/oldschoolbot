import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { autoContractNeedsNewContract } from '@/mahoji/lib/abstracted_commands/farmingContractCommand.js';

describe('Auto Farming Contract after a finished contract', () => {
	test('a completed contract with the old crop still stored needs a new contract', () => {
		expect(
			autoContractNeedsNewContract({
				hasContract: false,
				difficultyLevel: null,
				plantToGrow: 'Whiteberry',
				plantTier: 3,
				contractsCompleted: 10
			})
		).toBe(true);
		expect(autoContractNeedsNewContract(undefined)).toBe(true);
		expect(autoContractNeedsNewContract(null)).toBe(true);
		expect(
			autoContractNeedsNewContract({
				hasContract: true,
				difficultyLevel: 'hard',
				plantToGrow: 'Whiteberry',
				plantTier: 3,
				contractsCompleted: 10
			})
		).toBe(false);
	});

	test('autoContract requests a new contract when hasContract is false, not when a contract object exists', () => {
		const src = readFileSync(resolve('src/mahoji/lib/abstracted_commands/farmingContractCommand.ts'), 'utf8');
		expect(src).toContain('autoContractNeedsNewContract(contract.contract)');
		expect(src).toContain('if (!hasActiveContract)');
		expect(src).not.toContain('if (!contract.contract)');
	});
});
