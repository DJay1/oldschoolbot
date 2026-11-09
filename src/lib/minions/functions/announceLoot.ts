import { EmbedBuilder } from '@oldschoolgg/discord';
import type { ArrayItemsResolved, Bank } from 'oldschooljs';

import { itemIconUrl } from '@/lib/bsc/rareAnnouncements.js';
import { Channel } from '@/lib/constants.js';
import { effectiveMonsters } from '@/lib/minions/data/killableMonsters/index.js';
import { countUsersWithItemInCl } from '@/lib/rawSql.js';

export default async function announceLoot({
	user,
	monsterID,
	notifyDrops: _notifyDrops,
	loot,
	team
}: {
	user: MUser;
	monsterID: number;
	notifyDrops?: number[] | ArrayItemsResolved;
	loot: Bank;
	team?: { leader: MUser; lootRecipient: MUser; size: number };
}) {
	if (!_notifyDrops) return;
	const notifyDrops = _notifyDrops.flat(Number.POSITIVE_INFINITY);
	const itemsToAnnounce = loot.clone().filter(i => notifyDrops.includes(i.id));
	if (itemsToAnnounce.length === 0) return;

	const recipient = team && team.size > 1 ? team.lootRecipient : user;
	const monsterName = effectiveMonsters.find(m => m.id === monsterID)?.name ?? 'Unknown';
	const kc = await recipient.getKC(monsterID);

	for (const [item, qty] of itemsToAnnounce.items()) {
		const receivedSoFar = await countUsersWithItemInCl(item.id, false);
		const itemName = qty > 1 ? `${qty}x ${item.name}` : item.name;
		const lines: string[] = [];
		if (team && team.size > 1) {
			lines.push(`Party of ${team.size} led by **${team.leader.badgedUsername}** killing ${monsterName}`);
		}
		lines.push(`**${recipient.badgedUsername}** received **${itemName}**`);
		lines.push(`${monsterName} KC: **${kc.toLocaleString()}**`);
		lines.push(`Received so far: **${receivedSoFar.toLocaleString()}**`);

		const embed = new EmbedBuilder()
			.setColor(0xfa_a6_1a)
			.setTitle('Rare Drop')
			.setDescription(lines.join('\n'))
			.setThumbnail(itemIconUrl(item.id));

		await globalClient.sendMessage(Channel.Notifications, {
			embeds: [embed],
			allowedMentions: { parse: [], users: [], roles: [] }
		});
	}
}
