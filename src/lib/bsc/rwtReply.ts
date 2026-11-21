import { readFile } from 'node:fs/promises';

export const RWT_MESSAGE =
	'No RWT. This includes anything related to RWT in the real OSRS game, bot GP, or real money. You cannot buy or sell anything from OSRS and/or the bot for real money. You will be banned and wiped.';

export const RWT_GIF_PATHS = ['./assets/images/rwt-giving.gif', './assets/images/rwt-stealing.gif'] as const;

export const RWT_PREFIX_RE = /^[.!]rwt$/i;

export const RWT_MAX_GIF_BYTES = 2 * 1024 * 1024;

export function pickRwtGif(random: () => number = Math.random): (typeof RWT_GIF_PATHS)[number] {
	const idx = Math.floor(random() * RWT_GIF_PATHS.length) % RWT_GIF_PATHS.length;
	return RWT_GIF_PATHS[idx]!;
}

export async function rwtReply(random: () => number = Math.random) {
	const path = pickRwtGif(random);
	return {
		content: RWT_MESSAGE,
		files: [{ name: 'rwt.gif', buffer: await readFile(path) }],
		allowedMentions: { parse: [] as const, users: [] as const, roles: [] as const }
	};
}
