import type { APIAllowedMentions } from 'discord-api-types/v10';

const USER_MENTION_RE = /<@!?(\d{17,20})>/g;

export function userIdsMentionedInContent(content: string | undefined): string[] {
	if (!content) return [];
	const ids = new Set<string>();
	for (const match of content.matchAll(USER_MENTION_RE)) {
		ids.add(match[1]);
	}
	return [...ids];
}

/**
 * Mentions never ping @everyone/@here, and role pings only happen when a
 * command lists specific role IDs. User pings are allowed only for IDs the
 * caller listed, or (when allowedMentions is omitted) IDs actually mentioned
 * in the message content.
 */
export function resolveAllowedMentions(
	content: string | undefined,
	allowedMentions: APIAllowedMentions | undefined
): APIAllowedMentions {
	if (allowedMentions === undefined) {
		return { parse: [], roles: [], users: userIdsMentionedInContent(content) };
	}
	return {
		parse: [],
		roles: allowedMentions.roles ?? [],
		users: allowedMentions.users ?? []
	};
}

export function messageAllowsUserPings(allowedMentions: APIAllowedMentions | undefined): boolean {
	return (allowedMentions?.users?.length ?? 0) > 0;
}
