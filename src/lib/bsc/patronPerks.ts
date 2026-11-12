import { addToDoubleLootTimer } from '@/lib/bso/doubleLoot.js';
import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';

import { userMention } from '@oldschoolgg/discord';
import { formatDuration, stringMatches } from '@oldschoolgg/toolkit';

import { GE_SLOTS_CACHE } from '@/lib/cache.js';
import backgroundImages from '@/lib/minions/data/bankBackgrounds.js';
import { withPatreonLink } from '@/lib/patreonLink.js';
import { getBscPatronOverride, updateBscPatronOverride } from './patronStore.js';
import {
	bscDoubleLootCooldownRemaining,
	bscDoubleLootDurationMs,
	bscPatronLevelFromBits,
	bscPatronNameForPerkTier,
	bscPatronTierByLevel,
	planBscPatronGift
} from './patronTiers.js';

export async function triggerBscDoubleLoot(user: MUser): Promise<string> {
	const perkTier = await user.fetchPerkTier();
	const duration = bscDoubleLootDurationMs(perkTier);
	if (!duration) {
		return withPatreonLink('Double loot is a Pack Leader perk. Biggest of Dogs gets a longer timer.');
	}
	const lastTime = user.user.last_patron_double_time_trigger;
	const cooldown = bscDoubleLootCooldownRemaining(lastTime ? lastTime.getTime() : null, Date.now());
	if (cooldown > 0) {
		return `This command is still on cooldown, you can use it again in: ${formatDuration(cooldown)}.`;
	}

	const group = await findGroupOfUser(user.id);
	await prisma.user.updateMany({
		where: { id: { in: group } },
		data: { last_patron_double_time_trigger: new Date() }
	});

	const name = bscPatronNameForPerkTier(perkTier) ?? 'Pack Leader';
	await addToDoubleLootTimer(duration, `${userMention(user.id)} used their weekly ${name} double loot`);
	return `Added ${formatDuration(duration)} of server-wide double loot.`;
}

export async function performBscPatronGift(donor: MUser, recipientId: string): Promise<string> {
	const recipient = await mUserFetch(recipientId);
	const donorState = await getBscPatronOverride(donor.id);
	const recipientState = await getBscPatronOverride(recipient.id);
	const now = Date.now();
	const plan = planBscPatronGift({
		donorLevel: bscPatronLevelFromBits(donor.bitfield),
		donorLastGiftAt: donorState?.lastGiftAt ?? null,
		recipientLevel: bscPatronLevelFromBits(recipient.bitfield),
		recipientGiftTier: recipientState?.giftTier ?? null,
		recipientGiftUntil: recipientState?.giftUntil ?? null,
		sameUser: donor.id === recipient.id,
		recipientName: recipient.usernameOrMention,
		now
	});
	if (!plan.ok) return plan.message;

	await updateBscPatronOverride(donor.id, { lastGiftAt: now });
	await updateBscPatronOverride(recipient.id, { giftTier: plan.giftLevel, giftUntil: plan.until });
	GE_SLOTS_CACHE.delete(recipient.id);
	await recipient.fetchPerkTier({ forceNoCache: true });
	return plan.message;
}

export async function assignBscCustomBackground(user: MUser, name: string): Promise<string> {
	const state = await getBscPatronOverride(user.id);
	const level = Math.max(bscPatronLevelFromBits(user.bitfield), state?.tier ?? 0);
	const allowed = level >= 6 || (level >= 5 && Boolean(state?.customBackground));
	if (!allowed) {
		return 'Custom bank backgrounds are for Biggest of Dogs. They keep that image while they stay Pack Leader or higher. Set that tier first.';
	}
	const match = backgroundImages.find(img => stringMatches(img.name, name) || String(img.id) === name.trim());
	if (!match) return `No bank background named ${name}.`;
	await user.update({ bankBackground: match.id });
	await updateBscPatronOverride(user.id, {
		customBackground: true,
		customBackgroundId: match.id
	});
	const tierName = bscPatronTierByLevel(level)?.name ?? 'Biggest of Dogs';
	return `Assigned the ${match.name} bank background to ${user.usernameOrMention} (${tierName}). It stays while they are Pack Leader or higher.`;
}
