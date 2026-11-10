export function contentMentionsBot(content: string, clientId: string): boolean {
	return new RegExp(`<@!?${clientId}>`).test(content);
}

export type ParsedBotMention =
	| { kind: 'none' }
	| { kind: 'status' }
	| { kind: 'command'; name: string; args: string }
	| { kind: 'unknown'; text: string };

const surroundingMention = String.raw`(?:<@!?\d+>|<@&\d+>)`;

export function parseBotMention(content: string, clientId: string, commandList: string[]): ParsedBotMention {
	const trimmed = content.trim();
	if (!contentMentionsBot(trimmed, clientId)) return { kind: 'none' };

	const mention = `<@!?${clientId}>`;
	const leading = new RegExp(`^(?:\\s*${surroundingMention})*\\s*${mention}\\s*(?:\\s*${surroundingMention}\\s*)*`);
	const startMatch = trimmed.match(leading);
	if (!startMatch) {
		return { kind: 'unknown', text: trimmed };
	}

	const rest = trimmed.slice(startMatch[0].length).trim();
	if (!rest) return { kind: 'status' };

	const commandMatch = rest.match(new RegExp(`^(${commandList.join('|')})\\s*(.*)$`, 'i'));
	if (commandMatch) {
		return { kind: 'command', name: commandMatch[1].toLowerCase(), args: commandMatch[2] ?? '' };
	}
	return { kind: 'unknown', text: rest };
}

export function mentionUsageHelp(): string {
	return 'Tag me by itself for your minion status, or add a command like `stats`, `bank`, `cd`, or `patreon`.';
}
