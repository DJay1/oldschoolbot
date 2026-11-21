import { EmbedBuilder, type PaginatedPages } from '@oldschoolgg/discord';
import { chunk } from 'remeda';

import { trimAtEmojiBoundary } from '@/lib/badges/badgeEmojis.js';

const LB_PAGE_SIZE = 10;

function getPos(page: number, record: number) {
	return `${page * LB_PAGE_SIZE + 1 + record}. `;
}

/** Embed description limit is 4096; keep 150+ headroom. */
export const LB_PAGE_MAX_CHARS = 3900;
const EMOJI_MARKUP = /<a?:\w+:\d+>/g;
const BADGE_RUN = /(?:<a?:\w+:\d+>\s*){4,}/g;

/**
 * Join leaderboard lines. If a page is too long (players with many badges), trim each
 * name's badge row to its first 3 icons, then hard-cap the text so Discord never rejects it.
 */
export function fitLeaderboardPage(lines: string[]): string {
	const full = lines.join('\n');
	if (full.length <= LB_PAGE_MAX_CHARS) return full;
	const trimmed = lines
		.map(line => line.replace(BADGE_RUN, run => `${(run.match(EMOJI_MARKUP) ?? []).slice(0, 3).join(' ')} `))
		.join('\n');
	if (trimmed.length <= LB_PAGE_MAX_CHARS) return trimmed;
	return trimAtEmojiBoundary(trimmed, LB_PAGE_MAX_CHARS);
}

export type LeaderboardUser<M extends object = {}> = { id: string; score: number; customName?: string } & M;

export async function doMenuWrapper<M extends object = {}>({
	users,
	title,
	ironmanOnly,
	formatter,
	render,
	interaction
}: {
	ironmanOnly: boolean;
	users: LeaderboardUser<M>[];
	title: string;
	interaction: MInteraction;
	formatter?: (val: number) => string;
	render?: (user: LeaderboardUser<M>, username: string) => string;
}) {
	const chunked = chunk(users, LB_PAGE_SIZE);
	const pages: PaginatedPages = [];
	for (let c = 0; c < chunked.length; c++) {
		const makePage = async () => {
			const chnk = chunked[c];
			const linesPromises = chnk.map(async (user, i) => {
				const username: string = user.customName ?? (await Cache.getBadgedUsername(user.id));
				const body = render
					? render(user, username)
					: `**${username}:** ${formatter ? formatter(user.score) : user.score.toLocaleString()}`;
				return `${getPos(c, i)}${body}`;
			});
			const pageText = fitLeaderboardPage(await Promise.all(linesPromises));
			return {
				embeds: [
					new EmbedBuilder()
						.setTitle(`${title}${ironmanOnly ? ' (Ironmen Only)' : ''}`)
						.setDescription(pageText)
				]
			};
		};
		pages.push(makePage);
	}
	if (pages.length === 0) return 'There are no users on this leaderboard.';
	return interaction.makePaginatedMessage({ pages });
}
