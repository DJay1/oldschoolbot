import { BitField, globalConfig } from '@/lib/constants.js';

export const BSC_STAFF_ROLE_BITS: readonly { bit: BitField; roleId: string }[] = [
	{ bit: BitField.Developer, roleId: '1569683439190286346' },
	{ bit: BitField.Contributor, roleId: '1569683812621881454' },
	{ bit: BitField.Moderator, roleId: '1325179339641458749' }
];

export function staffRoleBitsEnabled(): boolean {
	return globalConfig.isProduction;
}

export function staffBitChanges(
	bitfield: readonly number[],
	roleIds: readonly string[]
): { add: BitField[]; remove: BitField[] } {
	const add: BitField[] = [];
	const remove: BitField[] = [];
	for (const { bit, roleId } of BSC_STAFF_ROLE_BITS) {
		const hasRole = roleIds.includes(roleId);
		const hasBit = bitfield.includes(bit);
		if (hasRole && !hasBit) add.push(bit);
		if (!hasRole && hasBit) remove.push(bit);
	}
	return { add, remove };
}

export async function syncBscStaffBitsFromRoles(userId: string, roleIds: readonly string[]): Promise<void> {
	if (!staffRoleBitsEnabled()) return;
	const existing = await prisma.user.findUnique({ where: { id: userId }, select: { bitfield: true } });
	if (!existing) return;
	const { add, remove } = staffBitChanges(existing.bitfield, roleIds);
	if (add.length === 0 && remove.length === 0) return;
	const user = await mUserFetch(userId);
	const next = [...user.bitfield.filter(bit => !remove.includes(bit)), ...add];
	await user.update({ bitfield: next });
	await user.fetchPerkTier({ forceNoCache: true });
}
