import type { MahoganyHomesActivityTaskOptions } from '@/lib/types/minions.js';

export const mahoganyHomesTask: MinionTask = {
	type: 'MahoganyHomes',
	async run(data: MahoganyHomesActivityTaskOptions, { user, handleTripFinish }) {
		let { channelId, quantity, xp, duration, points } = data;

		await user.incrementMinigameScore('mahogany_homes', quantity);

		const xpRes = await user.addXP({
			skillName: 'construction',
			amount: xp,
			duration,
			source: 'MahoganyHomes'
		});
		const flappyRes = await user.hasFlappy(duration);
		if (flappyRes.shouldGiveBoost) {
			points *= 2;
		}

		await user.update({
			carpenter_points: {
				increment: points
			}
		});

		const str = `${user}, ${user.minionName} finished doing ${quantity}x Mahogany Homes contracts, you received ${points} Carpenter points. ${xpRes} ${flappyRes.userMsg}`;

		handleTripFinish({ user, channelId, message: str, data });
	}
};
