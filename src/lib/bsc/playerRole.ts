import { bscSupportServerId } from '@/lib/bsc/patronTiers.js';
import { globalConfig } from '@/lib/constants.js';

export const BSC_PLAYER_ROLE_ID = '1569683645826863165';

export function playerRoleEnabled(): boolean {
	return globalConfig.isProduction;
}

export function playerRoleChange(hasMinion: boolean, roleIds: readonly string[]): 'add' | 'remove' | null {
	const hasRole = roleIds.includes(BSC_PLAYER_ROLE_ID);
	if (hasMinion && !hasRole) return 'add';
	if (!hasMinion && hasRole) return 'remove';
	return null;
}

async function applyPlayerRole(userId: string, change: 'add' | 'remove') {
	const guildId = bscSupportServerId();
	const request =
		change === 'add'
			? globalClient.giveRole(guildId, userId, BSC_PLAYER_ROLE_ID)
			: globalClient.takeRole(guildId, userId, BSC_PLAYER_ROLE_ID);
	await request.catch(err => {
		Logging.logDebug(`BSC player role: could not ${change} the role for ${userId}`, {
			error: (err as Error).message
		});
	});
}

export async function syncBscPlayerRole(userId: string, roleIds: readonly string[]): Promise<void> {
	if (!playerRoleEnabled()) return;
	const row = await prisma.user.findUnique({ where: { id: userId }, select: { minion_hasBought: true } });
	const change = playerRoleChange(Boolean(row?.minion_hasBought), roleIds);
	if (change) await applyPlayerRole(userId, change);
}

export async function giveBscPlayerRole(userId: string): Promise<void> {
	if (!playerRoleEnabled()) return;
	await applyPlayerRole(userId, 'add');
}
