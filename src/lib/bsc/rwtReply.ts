import { readFile } from 'node:fs/promises';

export const RWT_GIF_PATH = './assets/images/rwt-stealing.gif';

export const RWT_PREFIX_RE = /^[.!]rwt$/i;

export const RWT_MAX_GIF_BYTES = 2 * 1024 * 1024;

export async function rwtReply() {
	return {
		files: [{ name: 'rwt.gif', buffer: await readFile(RWT_GIF_PATH) }],
		allowedMentions: { parse: [], users: [], roles: [] }
	};
}
