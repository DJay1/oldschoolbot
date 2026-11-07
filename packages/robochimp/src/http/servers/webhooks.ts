import { Hono } from 'hono';

import { type HonoServerGeneric, httpErr } from '@/http/serverUtil.js';
import { type GithubSponsorsWebhookData, verifyGithubSecret } from '@/lib/githubSponsor.js';
import { patreonTask, verifyPatreonSecret } from '@/lib/patreon.js';

export const webhooksServer = new Hono<HonoServerGeneric>();

webhooksServer.post('/patreon', async c => {
	const signature = c.req.header('x-patreon-signature');
	if (!signature) return httpErr.BAD_REQUEST({ message: 'Missing header' });

	const raw = await c.req.text();
	if (!raw || typeof raw !== 'string') {
		return httpErr.BAD_REQUEST({ message: 'Missing body' });
	}

	console.log('Patreon webhook coming in...');
	const isVerified = verifyPatreonSecret(raw, signature);
	if (!isVerified) return httpErr.BAD_REQUEST({ message: 'Unverified' });
	console.log('Verified! Syncing patreon...');

	// biome-ignore lint/nursery/noFloatingPromises:-
	patreonTask.run().then(res => {
		if (res) {
			console.log(res.join('\n').slice(0, 1950));
		}
	});

	return c.text('OK');
});

webhooksServer.post('/github', async c => {
	const sig = c.req.header('x-hub-signature');
	const raw = await c.req.text();

	let parsed: GithubSponsorsWebhookData | null = null;
	try {
		parsed = JSON.parse(raw) as GithubSponsorsWebhookData;
	} catch {
		return httpErr.BAD_REQUEST();
	}

	const isVerified = verifyGithubSecret(JSON.stringify(parsed), sig);
	if (!isVerified) return httpErr.BAD_REQUEST();

	console.log('BSC: GitHub sponsor sync is disabled. Patron tiers come from Discord roles.');
	return c.text('OK');
});
