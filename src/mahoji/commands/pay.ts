import { Events, sleep } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { Prisma } from '@/prisma/main.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

export const payCommand = defineCommand({
	name: 'pay',
	flags: ['REQUIRES_LOCK'],
	description: 'Send GP to another user.',
	options: [
		{
			type: 'User',
			name: 'user',
			description: 'The user you want to send the GP too.',
			required: true
		},
		{
			type: 'String',
			name: 'amount',
			description: 'The amount you want to send. (e.g. 100k, 1m, 2.5b, 5*100m)',
			required: true
		}
	],
	run: async ({ options, user, interaction, guildId }) => {
		await interaction.defer();
		const recipient = await mUserFetch(options.user.user.id);
		const amount = mahojiParseNumber({ input: options.amount, min: 1, max: 500_000_000_000 });
		if (!amount) return "That's not a valid amount.";
		const { GP } = user;
		if (await recipient.isBlacklisted()) return "Blacklisted players can't receive money.";
		if (recipient.id === user.id) return "You can't send money to yourself.";
		if (user.isIronman) return "Iron players can't send money.";
		if (recipient.isIronman) return "Iron players can't receive money.";
		if (GP < amount) return "You don't have enough GP.";
		if (options.user.user.bot) return "You can't send money to a bot.";
		if (await recipient.getIsLocked()) return 'That user is busy right now.';

		if (amount > 500_000_000) {
			await interaction.confirmation(
				`Are you sure you want to pay ${recipient.username} (ID: ${recipient.id}) ${amount.toLocaleString()}?`
			);
		}

		const MAX_RETRIES = 5;
		let retries = 0;

		while (retries < MAX_RETRIES) {
			try {
				const paid = await prisma.$transaction(
					async tx => {
						const charged = await tx.user.updateMany({
							where: { id: user.id, GP: { gte: BigInt(amount) } },
							data: { GP: { decrement: BigInt(amount) } }
						});
						if (charged.count !== 1) return false;
						await tx.user.update({
							where: { id: recipient.id },
							data: { GP: { increment: BigInt(amount) } },
							select: { id: true }
						});
						return true;
					},
					{
						isolationLevel: 'RepeatableRead'
					}
				);
				if (!paid) return "You don't have enough GP.";
				await Promise.all([user.sync(), recipient.sync()]);
				break;
			} catch (error) {
				if ((error as Prisma.PrismaClientKnownRequestError).code === 'P2034') {
					retries++;
					if (retries < MAX_RETRIES) {
						await sleep(100 + retries * 333);
						continue;
					} else {
						throw error;
					}
				}
				throw error;
			}
		}

		await prisma.economyTransaction.create({
			data: {
				guild_id: guildId ? BigInt(guildId) : undefined,
				sender: BigInt(user.id),
				recipient: BigInt(recipient.id),
				items_sent: new Bank().add('Coins', amount),
				items_received: undefined,
				type: 'trade'
			},
			select: { id: true }
		});

		globalClient.emit(Events.EconomyLog, `${user.mention} paid ${amount} GP to ${recipient.mention}.`);
		await ClientSettings.addToGPTaxBalance(user, amount);

		return {
			content: `You sent ${amount.toLocaleString()} GP to ${recipient.mention}.`,
			allowedMentions: { users: [recipient.id] }
		};
	}
});
