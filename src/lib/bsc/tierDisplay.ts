import { formatDuration } from '@oldschoolgg/toolkit';

import { getBscPatronOverride } from '@/lib/bsc/patronStore.js';
import { fetchSupportMemberRoleIds } from '@/lib/bsc/patronSync.js';
import {
	bscActiveGiftPerkTier,
	bscPatronLevelFromRoles,
	bscPatronNameForPerkTier,
	bscPatronTierFromBits,
	bscStaffLevelFromRoles
} from '@/lib/bsc/patronTiers.js';
import { BitField, PerkTier } from '@/lib/constants.js';

interface TierSource {
	perkTier: number;
	label: string | (() => Promise<string>);
}

function timeLeft(until: number, now: number) {
	return formatDuration(until - now, true);
}

export async function bscTierDisplay(user: MUser, perkTier: number): Promise<string> {
	const name = bscPatronNameForPerkTier(perkTier);
	if (!name) return 'None';

	const now = Date.now();
	const override = await getBscPatronOverride(user.id).catch(() => null);
	const roboChimpUser = await Cache.getRoboChimpUser(user.id).catch(() => null);
	const sources: TierSource[] = [];

	if (user.isContributor() || user.isModOrAdmin() || user.isWikiContrib()) {
		sources.push({ perkTier: PerkTier.Four, label: 'Staff' });
	} else if (user.isTrusted()) {
		sources.push({ perkTier: PerkTier.Three, label: 'Staff' });
	}

	const bitTier = bscPatronTierFromBits(user.bitfield);
	if (bitTier) {
		sources.push({
			perkTier: bitTier.perkTier,
			label: override?.manual
				? 'Manual'
				: async () => {
						const roles = await fetchSupportMemberRoleIds(user.id);
						if (roles && bscStaffLevelFromRoles(roles) > bscPatronLevelFromRoles(roles)) return 'Staff';
						return 'Patreon';
					}
		});
	}

	if (user.bitfield.includes(BitField.HasPermanentTierOne)) {
		sources.push({ perkTier: PerkTier.Three, label: 'Permanent' });
	}

	const giftPerk = bscActiveGiftPerkTier(override?.giftTier ?? null, override?.giftUntil ?? null, now);
	if (giftPerk > 0 && override?.giftUntil) {
		sources.push({ perkTier: giftPerk, label: `Gift · ${timeLeft(override.giftUntil, now)} left` });
	}

	const rewardPerk = bscActiveGiftPerkTier(override?.rewardTier ?? null, override?.rewardUntil ?? null, now);
	if (rewardPerk > 0 && override?.rewardUntil) {
		sources.push({ perkTier: rewardPerk, label: `Tester reward · ${timeLeft(override.rewardUntil, now)} left` });
	}

	const premiumUntil = Number(roboChimpUser?.premium_balance_expiry_date ?? 0);
	if (roboChimpUser?.premium_balance_tier && premiumUntil > now) {
		sources.push({
			perkTier: roboChimpUser.premium_balance_tier,
			label: `Premium · ${timeLeft(premiumUntil, now)} left`
		});
	}

	const match = sources.find(source => source.perkTier === perkTier);
	if (!match) return name;
	const label = typeof match.label === 'string' ? match.label : await match.label();
	return `${name} (${label})`;
}
