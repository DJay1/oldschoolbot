import { gifs } from '@/lib/bsc/corgoGifs.js';
import { runStaffBoost, staffBoostsUsed, staffGuildAllowed, staffTierOf } from '@/lib/bsc/staffAccess.js';
import {
	STAFF_BOOST_LABELS,
	STAFF_BOOST_MINUTES,
	STAFF_TIER_NAMES,
	type StaffBoostKind,
	type StaffTier,
	staffActionsFor,
	staffBoostWeeklyCap,
	tierAtLeast
} from '@/lib/bsc/staffTiers.js';
import { globalConfig } from '@/lib/constants.js';
import { adminCommand } from '@/mahoji/commands/admin.js';
import { rpCommand } from '@/mahoji/commands/rp.js';

/** Copies an option from /admin or /rp so /staff runs the exact same handler with the same inputs. */
function copyOption(
	source: readonly CommandOption[],
	path: string[],
	name: string,
	description: string,
	filterSubs?: (sub: CommandOption) => boolean
): CommandOption {
	let opts: readonly CommandOption[] = source;
	let found: CommandOption | undefined;
	for (const part of path) {
		found = opts.find(o => o.name === part);
		if (!found) throw new Error(`/staff: missing option ${path.join(' ')}`);
		opts = ((found as { options?: CommandOption[] }).options ?? []) as CommandOption[];
	}
	const inner = ((found as { options?: CommandOption[] }).options ?? []) as CommandOption[];
	return {
		...(found as CommandOption),
		name,
		description,
		options: filterSubs ? inner.filter(filterSubs) : inner
	} as CommandOption;
}

type Route = { tier: StaffTier; source: 'admin' | 'rp'; wrap: (opts: any) => Record<string, unknown> };

const ROUTES: Record<string, Route> = {
	view_bank: { tier: 'moderator', source: 'rp', wrap: o => ({ player: { viewbank: o } }) },
	view_gear: { tier: 'moderator', source: 'rp', wrap: o => ({ player: { viewgear: o } }) },
	view_user: { tier: 'moderator', source: 'rp', wrap: o => ({ player: { view_user: o } }) },
	list_trades: { tier: 'moderator', source: 'rp', wrap: o => ({ player: { list_trades: o } }) },
	ge_cancel: { tier: 'moderator', source: 'rp', wrap: o => ({ player: { ge_cancel: o } }) },
	cancel_task: { tier: 'moderator', source: 'admin', wrap: o => ({ cancel_task: o }) },
	tester_points: { tier: 'developer', source: 'admin', wrap: o => ({ testerpoints: o }) },
	item_stats: { tier: 'developer', source: 'admin', wrap: o => ({ item_stats: o }) },
	fix_giveaways: { tier: 'developer', source: 'admin', wrap: o => ({ fix_giveaways: o }) },
	leagues: { tier: 'developer', source: 'admin', wrap: o => ({ leagues: o }) },
	announce: { tier: 'developer', source: 'admin', wrap: o => ({ announce: o }) },
	event_list: { tier: 'developer', source: 'admin', wrap: () => ({ event: { action: 'list' } }) }
};

async function staffHelp(user: MUser, tier: StaffTier): Promise<string> {
	const used = await staffBoostsUsed(user.id);
	const cap = staffBoostWeeklyCap(tier);
	const lines = [`**Your staff role: ${STAFF_TIER_NAMES[tier]}**`, ''];
	for (const action of staffActionsFor(tier)) {
		lines.push(`**${action.command}**: ${action.help}`);
	}
	lines.push('');
	lines.push(`**Boosts left this week** (each adds ${STAFF_BOOST_MINUTES} min, resets Monday 12:00 AM CT):`);
	for (const kind of ['loot', 'xp'] as StaffBoostKind[]) {
		lines.push(`${STAFF_BOOST_LABELS[kind]}: ${Math.max(cap - used[kind], 0)}/${cap}`);
	}
	return lines.join('\n');
}

export const staffCommand = defineCommand({
	name: 'staff',
	description: 'Staff tools. Use /staff help to see what your role can use.',
	guildId: globalConfig.supportServerID,
	privateSubcommands: ['help'],
	options: [
		{
			type: 'Subcommand',
			name: 'help',
			description: 'See the staff commands your role can use and your boosts left.'
		},
		{
			type: 'Subcommand',
			name: 'boost',
			description: `Add ${STAFF_BOOST_MINUTES} min of 2x loot or 2x XP for everyone (weekly limit).`,
			options: [
				{
					type: 'String',
					name: 'type',
					description: 'Which boost to add.',
					required: true,
					choices: [
						{ name: '2x loot', value: 'loot' },
						{ name: '2x XP', value: 'xp' }
					]
				}
			]
		},
		copyOption(rpCommand.options, ['player', 'viewbank'], 'view_bank', "Mod: look at a player's bank."),
		copyOption(rpCommand.options, ['player', 'viewgear'], 'view_gear', "Mod: look at a player's gear."),
		copyOption(rpCommand.options, ['player', 'view_user'], 'view_user', "Mod: look at a player's account info."),
		copyOption(rpCommand.options, ['player', 'list_trades'], 'list_trades', "Mod: list a player's trades."),
		copyOption(
			rpCommand.options,
			['player', 'ge_cancel'],
			'ge_cancel',
			"Mod: cancel a player's GE listings (refunded, logged)."
		),
		copyOption(adminCommand.options, ['cancel_task'], 'cancel_task', "Mod: cancel a player's stuck trip (logged)."),
		copyOption(
			adminCommand.options,
			['testerpoints'],
			'tester_points',
			'Dev: give or take tester points (logged).'
		),
		copyOption(adminCommand.options, ['item_stats'], 'item_stats', 'Dev: how many of an item exist.'),
		copyOption(adminCommand.options, ['fix_giveaways'], 'fix_giveaways', 'Dev: put buttons back on giveaways.'),
		copyOption(
			adminCommand.options,
			['leagues'],
			'leagues',
			'Dev: check and repair leagues task data.',
			sub => sub.name === 'validate_tasks' || sub.name === 'verify_tasks'
		),
		copyOption(
			adminCommand.options,
			['announce'],
			'announce',
			'Dev: post in notifications (no role pings, logged).'
		),
		{
			type: 'Subcommand',
			name: 'event_list',
			description: 'Dev: list seasonal events and whether they are on.'
		}
	] as CommandOption[],
	run: async ctx => {
		const { user, guildId, interaction, rng } = ctx;
		const options = ctx.options as Record<string, any>;
		if (!staffGuildAllowed(guildId)) return rng.pick(gifs);
		const tier = staffTierOf(user);
		if (tier === 'none') return rng.pick(gifs);

		if (options.help) return staffHelp(user, tier);

		if (options.boost) {
			await interaction.defer();
			const kind = options.boost.type === 'xp' ? 'xp' : 'loot';
			return runStaffBoost(user, kind);
		}

		const key = Object.keys(ROUTES).find(k => options[k] !== undefined && options[k] !== null);
		if (!key) return 'Invalid command.';
		const route = ROUTES[key];
		if (!tierAtLeast(tier, route.tier)) {
			return `That needs the ${STAFF_TIER_NAMES[route.tier]} role. Use /staff help to see your commands.`;
		}
		const command = route.source === 'admin' ? adminCommand : rpCommand;
		// The /admin or /rp handler checks the tier again before doing anything.
		return command.run({ ...ctx, options: route.wrap(options[key]) } as any);
	}
});
