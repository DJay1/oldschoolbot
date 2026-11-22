import type { Bank } from 'oldschooljs';

import { groupTripExtraMemberIDs } from '@/lib/util/groupTripMembers.js';
import { hasHarvestBlessing, rollThanksgivingTripParts, type ThanksgivingRng } from './core.js';

export type HarvestPartyImageItems = { userId: string; items: Bank };

export function formatPartyHarvestFinds(finds: { mention: string; parts: Bank }[]): string | null {
	if (finds.length === 0) return null;
	return `🌽 ${finds.map(f => `${f.mention} gathered ${f.parts}`).join(', ')} for The Straw Hat Harvest.`;
}

export async function creditHarvestPartsToExtraMembers({
	data,
	leaderID,
	durationMs,
	doubleLoot,
	rng,
	fetchUser = mUserFetch
}: {
	data: object;
	leaderID: string;
	durationMs: number;
	doubleLoot: boolean;
	rng: ThanksgivingRng;
	fetchUser?: (id: string) => Promise<MUser>;
}): Promise<{ messages: string[]; imageItems: HarvestPartyImageItems[] }> {
	const finds: { mention: string; parts: Bank }[] = [];
	const imageItems: HarvestPartyImageItems[] = [];
	for (const id of groupTripExtraMemberIDs(data, leaderID)) {
		let member: MUser;
		try {
			member = await fetchUser(id);
		} catch (err) {
			Logging.logError(err as Error, { user_id: id, source: 'harvestPartyMemberFetch' });
			continue;
		}
		const parts = rollThanksgivingTripParts({
			durationMs,
			doubleLoot,
			blessing: hasHarvestBlessing(member),
			rng
		});
		if (parts.length === 0) continue;
		try {
			await member.transactItems({ itemsToAdd: parts, collectionLog: true });
			finds.push({ mention: member.usernameOrMention, parts });
			imageItems.push({ userId: id, items: parts });
		} catch (err) {
			Logging.logError(err as Error, { user_id: id, source: 'harvestPartyMember' });
		}
	}
	const msg = formatPartyHarvestFinds(finds);
	return { messages: msg ? [msg] : [], imageItems };
}
