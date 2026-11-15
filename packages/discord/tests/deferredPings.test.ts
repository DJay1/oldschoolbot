import { describe, expect, it } from 'vitest';

import { BaseInteraction, DEFERRED_PING_PLACEHOLDER } from '../src/interactions/BaseInteraction.js';

const A = '111111111111111111';
const B = '222222222222222222';
const C = '333333333333333333';

type Call = { method: 'post' | 'patch' | 'delete' | 'get'; route: string; body: any };

function makeInteraction({ failCreate = false }: { failCreate?: boolean } = {}) {
	const calls: Call[] = [];
	let n = 0;
	const rest = {
		post: async (route: string, opts: any) => {
			calls.push({ method: 'post', route, body: opts?.body });
			if (failCreate && route === '/webhooks/app/tok') throw new Error('follow-up rejected');
			return route === '/webhooks/app/tok' ? { id: `created-${++n}` } : null;
		},
		patch: async (route: string, opts: any) => {
			calls.push({ method: 'patch', route, body: opts?.body });
			return {};
		},
		delete: async (route: string) => {
			calls.push({ method: 'delete', route, body: null });
		},
		get: async (route: string) => {
			calls.push({ method: 'get', route, body: null });
			return {};
		}
	};
	const interaction = new BaseInteraction({
		client: { rest } as any,
		applicationId: 'app',
		rawInteraction: {} as any,
		data: {
			id: 'itx',
			token: 'tok',
			user_id: A,
			kind: 'ChatInputCommand',
			channel_id: 'chan',
			guild_id: 'guild',
			created_timestamp: Date.now()
		} as any
	});
	const webhookCreates = () => calls.filter(c => c.method === 'post' && c.route === '/webhooks/app/tok');
	const edits = () => calls.filter(c => c.method === 'patch');
	return { interaction, calls, webhookCreates, edits };
}

describe('deferred replies ping mentioned users', () => {
	it('first reply after defer with a user mention posts a follow-up and neutralizes the placeholder', async () => {
		const { interaction, calls, webhookCreates, edits } = makeInteraction();
		await interaction.baseDeferReply();
		await interaction.baseReply({ content: `Trade with <@${B}>`, allowedMentions: { users: [B, A] } });
		expect(webhookCreates()).toHaveLength(1);
		expect(webhookCreates()[0].body.allowed_mentions).toEqual({ parse: [], roles: [], users: [B, A] });
		expect(edits()).toHaveLength(1);
		expect(edits()[0].route).toContain('%40original');
		expect(edits()[0].body.content).toBe(DEFERRED_PING_PLACEHOLDER);
		expect(edits()[0].body.components).toEqual([]);
		expect(calls.some(c => c.method === 'delete')).toBe(false);
		expect(interaction.replied).toBe(true);
		// Order matters: Discord turns the first webhook message after a defer into the deferred reply
		// (an edit, no ping), so the placeholder must be resolved BEFORE the follow-up is created.
		const editIdx = calls.findIndex(c => c.method === 'patch');
		const createIdx = calls.findIndex(c => c.method === 'post' && c.route === '/webhooks/app/tok');
		expect(editIdx).toBeGreaterThan(-1);
		expect(editIdx).toBeLessThan(createIdx);
	});

	it('if the follow-up fails, the original is edited to the full reply so the command still works', async () => {
		const { interaction, edits } = makeInteraction({ failCreate: true });
		await interaction.baseDeferReply();
		await interaction.baseReply({ content: `Trade with <@${B}>`, allowedMentions: { users: [B] } });
		expect(edits()).toHaveLength(2);
		expect(edits()[0].body.content).toBe(DEFERRED_PING_PLACEHOLDER);
		expect(edits()[1].route).toContain('%40original');
		expect(edits()[1].body.content).toBe(`Trade with <@${B}>`);
		// Not marked as pinged, so a later reply still tries a notifying follow-up.
		await interaction.baseReply({ content: `Done <@${B}>`, allowedMentions: { users: [B] } });
		expect(edits().at(-1)!.body.content).toBe(`Done <@${B}>`);
	});

	it('later replies to the same users edit the follow-up (no re-ping, no double post)', async () => {
		const { interaction, webhookCreates, edits } = makeInteraction();
		await interaction.baseDeferReply();
		await interaction.baseReply({ content: `Confirm <@${B}>`, allowedMentions: { users: [B] } });
		await interaction.baseReply({ content: `1/2 confirmed <@${B}>`, allowedMentions: { users: [B] } });
		await interaction.baseReply({ content: `Done <@${B}>`, allowedMentions: { users: [B] } });
		expect(webhookCreates()).toHaveLength(1);
		const followUpEdits = edits().filter(e => e.route.endsWith('/created-1'));
		expect(followUpEdits).toHaveLength(2);
	});

	it('edit without new pings stays an edit of the original', async () => {
		const { interaction, webhookCreates, edits } = makeInteraction();
		await interaction.baseDeferReply();
		await interaction.baseReply({ content: 'No mentions here' });
		await interaction.baseReply({ content: 'Still none' });
		expect(webhookCreates()).toHaveLength(0);
		expect(edits()).toHaveLength(2);
		expect(edits().every(e => e.route.includes('%40original'))).toBe(true);
	});

	it('mentions that are not allowed never cause a follow-up', async () => {
		const { interaction, webhookCreates } = makeInteraction();
		await interaction.baseDeferReply();
		await interaction.baseReply({
			content: `Hi <@${B}> @everyone <@&444444444444444444>`,
			allowedMentions: { users: [] }
		});
		expect(webhookCreates()).toHaveLength(0);
	});

	it('allowed users who are not mentioned in the content do not cause a follow-up', async () => {
		const { interaction, webhookCreates } = makeInteraction();
		await interaction.baseDeferReply();
		await interaction.baseReply({ content: 'Are you sure?', allowedMentions: { users: [A] } });
		expect(webhookCreates()).toHaveLength(0);
	});

	it('ephemeral deferred replies never post a follow-up', async () => {
		const { interaction, webhookCreates } = makeInteraction();
		await interaction.baseDeferReply({ ephemeral: true });
		await interaction.baseReply({ content: `Hi <@${B}>`, allowedMentions: { users: [B] } });
		expect(webhookCreates()).toHaveLength(0);
	});

	it('a new user later gets a new follow-up; the previous message only loses its buttons', async () => {
		const { interaction, webhookCreates, edits } = makeInteraction();
		await interaction.baseDeferReply();
		await interaction.baseReply({ content: `Hi <@${B}>`, allowedMentions: { users: [B] } });
		await interaction.baseReply({ content: `Hi <@${B}> and <@${C}>`, allowedMentions: { users: [B, C] } });
		expect(webhookCreates()).toHaveLength(2);
		const last = edits().at(-1)!;
		expect(last.route.endsWith('/created-1')).toBe(true);
		expect(last.body.components).toEqual([]);
		expect(last.body.content).toBeUndefined();
	});

	it('non-deferred first reply notifies directly and counts as pinged', async () => {
		const { interaction, webhookCreates } = makeInteraction();
		await interaction.baseReply({ content: `Hi <@${B}>`, allowedMentions: { users: [B] } });
		await interaction.baseReply({ content: `Bye <@${B}>`, allowedMentions: { users: [B] } });
		expect(webhookCreates()).toHaveLength(0);
	});
});
