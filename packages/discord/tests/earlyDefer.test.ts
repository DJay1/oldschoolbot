import { describe, expect, it } from 'vitest';

import { BaseInteraction, wantsEphemeral } from '../src/interactions/BaseInteraction.js';

type Call = { method: 'post' | 'patch' | 'delete' | 'get'; route: string; body: any };

function makeInteraction() {
	const calls: Call[] = [];
	let n = 0;
	const rest = {
		post: async (route: string, opts: any) => {
			calls.push({ method: 'post', route, body: opts?.body });
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
			user_id: '111111111111111111',
			kind: 'ChatInputCommand',
			channel_id: 'chan',
			guild_id: 'guild',
			created_timestamp: Date.now()
		} as any
	});
	return { interaction, calls };
}

const EPHEMERAL = 1 << 6;

describe('ephemeral replies after an early public defer', () => {
	it('wantsEphemeral only for plain objects asking for it', () => {
		expect(wantsEphemeral('hi')).toBe(false);
		expect(wantsEphemeral({ content: 'hi' })).toBe(false);
		expect(wantsEphemeral({ content: 'hi', ephemeral: true })).toBe(true);
	});

	it('deletes the public placeholder and sends the reply as an ephemeral follow-up', async () => {
		const { interaction, calls } = makeInteraction();
		await interaction.baseDeferReply({ ephemeral: false });
		const res: any = await interaction.baseReply({ content: 'You are busy.', ephemeral: true });
		expect(calls.map(c => c.method)).toEqual(['post', 'delete', 'post']);
		expect(calls[1].route).toContain('%40original');
		const followUp = calls[2];
		expect(followUp.route).toBe('/webhooks/app/tok');
		expect(followUp.body.content).toBe('You are busy.');
		expect(followUp.body.flags & EPHEMERAL).toBe(EPHEMERAL);
		expect(res.id).toBe('created-1');
		expect(interaction.replied).toBe(true);
		expect(interaction.ephemeral).toBe(true);
	});

	it('later replies edit the ephemeral follow-up, not the deleted original', async () => {
		const { interaction, calls } = makeInteraction();
		await interaction.baseDeferReply({ ephemeral: false });
		await interaction.baseReply({ content: 'Confirm?', ephemeral: true });
		await interaction.baseReply({ content: 'Done', ephemeral: true });
		const last = calls[calls.length - 1];
		expect(last.method).toBe('patch');
		expect(last.route).toContain('created-1');
		expect(last.route).not.toContain('%40original');
	});

	it('public replies after a public defer still edit the original', async () => {
		const { interaction, calls } = makeInteraction();
		await interaction.baseDeferReply({ ephemeral: false });
		await interaction.baseReply({ content: 'Your bank' });
		expect(calls.map(c => c.method)).toEqual(['post', 'patch']);
		expect(calls[1].route).toContain('%40original');
	});

	it('an ephemeral defer keeps editing the original', async () => {
		const { interaction, calls } = makeInteraction();
		await interaction.baseDeferReply({ ephemeral: true });
		await interaction.baseReply({ content: 'secret', ephemeral: true });
		expect(calls.map(c => c.method)).toEqual(['post', 'patch']);
	});

	it('a second defer is a no-op', async () => {
		const { interaction, calls } = makeInteraction();
		await interaction.baseDeferReply({ ephemeral: false });
		await interaction.baseDeferReply({ ephemeral: true });
		expect(calls).toHaveLength(1);
	});
});
