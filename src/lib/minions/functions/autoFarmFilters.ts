import { Bank } from 'oldschooljs';

import { calcNumOfPatches } from '@/lib/skilling/skills/farming/utils/calcsFarming.js';
import type { IPatchDataDetailed } from '@/lib/skilling/skills/farming/utils/types.js';
import type { Plant } from '@/lib/skilling/types.js';

export function replant(
	p: Plant,
	farmingLevel: number,
	user: MUser,
	userBank: Bank,
	patchesDetailed: IPatchDataDetailed[]
) {
	if (p.level > farmingLevel) return false;
	const [numOfPatches] = calcNumOfPatches(p, user, user.QP);
	if (numOfPatches === 0) return false;
	// Enough seeds for at least one patch of this same crop. Leftover patches stay empty
	// instead of blocking the replant or switching to a different seed.
	if (!userBank.has(p.inputItems)) return false;
	const patchData = patchesDetailed.find(_p => _p.patchName === p.seedType)!;
	if (patchData.ready === true && p.name === patchData.plant?.name) return true;
	return false;
}

export function allFarm(p: Plant, farmingLevel: number, user: MUser, userBank: Bank) {
	if (p.level > farmingLevel) return false;
	const [numOfPatches] = calcNumOfPatches(p, user, user.QP);
	if (numOfPatches === 0) return false;
	// Enough seeds for at least one patch. Auto Farm plants as many of this crop as the
	// player has, and leaves leftover patches empty rather than switching crops.
	if (!userBank.has(p.inputItems)) return false;
	return true;
}
