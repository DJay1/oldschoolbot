import Firemaking from '@/lib/skilling/skills/firemaking.js';
import type { FiremakingActivityTaskOptions } from '@/lib/types/minions.js';

export const firemakingTask: MinionTask = {
	type: 'Firemaking',
	async run(data: FiremakingActivityTaskOptions, { user, handleTripFinish }) {
		const { burnableID, quantity, channelId } = data;

		const burnable = Firemaking.Burnables.find(Burn => Burn.inputLogs === burnableID)!;

		const xpReceived = quantity * burnable.xp;

		const xpRes = await user.addXP({
			skillName: 'firemaking',
			amount: xpReceived,
			duration: data.duration
		});

		const str = `${user}, ${user.minionName} finished lighting ${quantity} ${burnable.name}. ${xpRes}`;

		handleTripFinish({ user, channelId, message: str, data });
	}
};
