/**
 * Files a ticket from the afternoon bug scan without Discord. The bot's ticket_posts ticker posts it to the
 * staff ticket channel within a minute. Nothing reaches the player until staff press Confirm.
 *
 *   pnpm tsx --env-file=.env.test scripts/file-ticket.ts --type bug --user 123456789012345678 --command "/fish" --what "Trip stopped at 3000 fish"
 *
 * --user is optional (leave it out for bot-wide bugs). Uses the same validation as the bot (prepareNewTicket).
 */
import { Client } from 'pg';

import { prepareNewTicket } from '@/lib/bsc/tickets.js';

function arg(name: string): string | null {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const prepared = prepareNewTicket({
	type: (arg('type') ?? 'bug') as 'bug',
	source: 'auto',
	reporterId: arg('user'),
	filedBy: 'scan',
	guildId: null,
	originChannelId: null,
	what: arg('what') ?? '',
	command: arg('command')
});
if (!prepared.ok) {
	console.error(prepared.error);
	process.exit(1);
}
const t = prepared.ticket;
const client = new Client({ connectionString: process.env.DATABASE_URL!.split('?')[0] });
await client.connect();
const res = await client.query<{ id: number }>(
	`INSERT INTO bsc_tickets (type, source, reporter_id, filed_by, guild_id, origin_channel_id, what, command, screenshot)
	 VALUES ($1, 'auto', $2, $3, NULL, NULL, $4, $5, NULL) RETURNING id`,
	[t.type, t.reporterId, t.filedBy, t.what, t.command]
);
await client.end();
console.log(`Filed ticket #${res.rows[0].id}. The bot posts it to the staff ticket channel within a minute.`);
