import { ButtonBuilder, ButtonStyle, EmbedBuilder, SpecialResponse } from '@oldschoolgg/discord';

import { InteractionID } from '@/lib/InteractionID.js';

export type PollVote = 'yes' | 'no';

const pollVotes = new Map<string, Map<string, PollVote>>();
const hydratedPolls = new Set<string>();
const pollLocks = new Map<string, Promise<unknown>>();

export function countPollVotes(votes: Map<string, PollVote> | Record<string, PollVote>): { yes: number; no: number } {
	let yes = 0;
	let no = 0;
	const values = votes instanceof Map ? votes.values() : Object.values(votes);
	for (const vote of values) {
		if (vote === 'yes') yes++;
		else if (vote === 'no') no++;
	}
	return { yes, no };
}

export function applyPollVote(
	votes: Record<string, PollVote>,
	userId: string,
	choice: PollVote
): { votes: Record<string, PollVote>; changed: boolean; previous: PollVote | null; yes: number; no: number } {
	const previous = votes[userId] ?? null;
	if (previous === choice) {
		return { votes, changed: false, previous, ...countPollVotes(votes) };
	}
	const next = { ...votes, [userId]: choice };
	return { votes: next, changed: true, previous, ...countPollVotes(next) };
}

export function pollButtons() {
	return [
		new ButtonBuilder().setCustomId(InteractionID.Poll.Yes).setLabel('Yes').setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId(InteractionID.Poll.No).setLabel('No').setStyle(ButtonStyle.Danger)
	];
}

export function buildPollEmbed({
	question,
	yes,
	no,
	askedBy
}: {
	question: string;
	yes: number;
	no: number;
	askedBy: string;
}) {
	return new EmbedBuilder()
		.setColor(0x58_65_f2)
		.setTitle('Poll')
		.setDescription(`**${question}**`)
		.addFields(
			{ name: 'Yes', value: String(yes), inline: true },
			{ name: 'No', value: String(no), inline: true }
		)
		.setFooter({ text: `Asked by ${askedBy}` });
}

export function parsePollEmbed(embed?: { description?: string | null; footer?: { text?: string } | null }): {
	question: string;
	askedBy: string;
} {
	const desc = embed?.description ?? '';
	let question = desc;
	if (question.startsWith('**') && question.endsWith('**') && question.length >= 4) {
		question = question.slice(2, -2);
	}
	const footer = embed?.footer?.text ?? '';
	const askedBy = footer.startsWith('Asked by ') ? footer.slice('Asked by '.length) : footer || 'Unknown';
	return { question: question || 'Poll', askedBy };
}

async function withPollLock<T>(messageId: string, fn: () => Promise<T>): Promise<T> {
	const prev = pollLocks.get(messageId) ?? Promise.resolve();
	let release!: () => void;
	const done = new Promise<void>(resolve => {
		release = resolve;
	});
	const next = prev.then(() => done);
	pollLocks.set(messageId, next);
	try {
		await prev;
		return await fn();
	} finally {
		release();
		if (pollLocks.get(messageId) === next) pollLocks.delete(messageId);
	}
}

async function getVoteMap(messageId: string): Promise<Map<string, PollVote>> {
	if (hydratedPolls.has(messageId)) return pollVotes.get(messageId)!;
	try {
		const fromRedis = await Cache.loadPollVotes(messageId);
		const map = pollVotes.get(messageId) ?? new Map<string, PollVote>();
		for (const [userId, vote] of fromRedis) {
			if (!map.has(userId)) map.set(userId, vote);
		}
		pollVotes.set(messageId, map);
		hydratedPolls.add(messageId);
		return map;
	} catch {
		return pollVotes.get(messageId) ?? new Map<string, PollVote>();
	}
}

export async function castPollVote(
	messageId: string,
	userId: string,
	choice: PollVote
): Promise<{ previous: PollVote | null; changed: boolean; yes: number; no: number }> {
	return withPollLock(messageId, async () => {
		const map = await getVoteMap(messageId);
		const previous = map.get(userId) ?? null;
		if (previous === choice) {
			return { previous, changed: false, ...countPollVotes(map) };
		}
		map.set(userId, choice);
		pollVotes.set(messageId, map);
		try {
			await Cache.persistPollVote(messageId, userId, choice);
		} catch {}
		return { previous, changed: true, ...countPollVotes(map) };
	});
}

export async function handlePollButton(user: MUser, id: string, interaction: OSInteraction): CommandResponse {
	const choice: PollVote | null =
		id === InteractionID.Poll.Yes ? 'yes' : id === InteractionID.Poll.No ? 'no' : null;
	if (!choice) {
		return { content: 'Invalid poll option.', ephemeral: true };
	}

	const result = await castPollVote(interaction.messageId, user.id, choice);
	if (!result.changed) {
		const label = choice === 'yes' ? 'Yes' : 'No';
		return { content: `You already voted ${label}.`, ephemeral: true };
	}

	const parsed = parsePollEmbed(interaction.message?.embeds?.[0]);
	await interaction.update({
		embeds: [
			buildPollEmbed({
				question: parsed.question,
				yes: result.yes,
				no: result.no,
				askedBy: parsed.askedBy
			})
		],
		components: pollButtons()
	});
	return SpecialResponse.RespondedManually;
}