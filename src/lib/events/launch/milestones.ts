import { Events, toTitleCase } from '@oldschoolgg/toolkit';
import { convertLVLtoXP } from 'oldschooljs';

import { isEventActive } from '@/lib/events/registry.js';
import { type SkillNameType, SkillsArray } from '@/lib/skilling/types.js';
import {
	LAUNCH_MAX_MILESTONE_ID,
	launchFirst99Announcement,
	launchFirstMaxAnnouncement,
	launchSkill99Id
} from './constants.js';

export const LAUNCH_LEVEL_99_XP = convertLVLtoXP(99);

/** DJ gets pinged for every first 99 so he can spawn the community gift. */
const LAUNCH_GIFT_OWNER_ID = '290167629966999552';

async function notifyLaunchOwner(text: string): Promise<void> {
	const channelId = process.env.LOG_CHANNEL_ID;
	if (!channelId) return;
	await globalClient
		.sendMessage(channelId, { content: `<@${LAUNCH_GIFT_OWNER_ID}> ${text}`, allowedMentions: { users: [LAUNCH_GIFT_OWNER_ID] } })
		.catch(() => null);
}

const ready = { done: false };

async function ensureLaunchMilestoneStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS launch_milestones (
			id text PRIMARY KEY,
			user_id text NOT NULL,
			announced_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);
	ready.done = true;
}

export async function launchMilestoneExists(id: string): Promise<boolean> {
	await ensureLaunchMilestoneStore();
	const rows = await prisma.$queryRaw<{ id: string }[]>`
		SELECT id FROM launch_milestones WHERE id = ${id} LIMIT 1
	`;
	return rows.length > 0;
}

/** Insert the one-time row. False when another caller already stored it. */
export async function claimLaunchMilestone(id: string, userId: string): Promise<boolean> {
	await ensureLaunchMilestoneStore();
	const rows = await prisma.$queryRaw<{ id: string }[]>`
		INSERT INTO launch_milestones (id, user_id, announced_at)
		VALUES (${id}, ${userId}, NOW())
		ON CONFLICT (id) DO NOTHING
		RETURNING id
	`;
	return rows.length > 0;
}

export function isLaunchSkill(skill: string): skill is SkillNameType {
	return (SkillsArray as readonly string[]).includes(skill);
}

async function usersAtOrAbove(skill: SkillNameType, xp: number): Promise<number> {
	const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
		`SELECT COUNT(*)::int AS count FROM users WHERE "skills.${skill}" >= ${Math.floor(xp)}`
	);
	return Number(rows[0]?.count ?? 0);
}

/**
 * Announce only when nobody has the milestone yet and this event has not announced it.
 * If the server already passed it, store a closed row so a later reset cannot announce a new "first".
 */
export async function maybeAnnounceLaunchFirst99(user: MUser, skill: string): Promise<void> {
	if (!isEventActive('launch') || !isLaunchSkill(skill)) return;
	const id = launchSkill99Id(skill);
	if (await launchMilestoneExists(id)) return;
	const others = await usersAtOrAbove(skill, LAUNCH_LEVEL_99_XP);
	if (others > 0) {
		await claimLaunchMilestone(id, 'already-reached');
		return;
	}
	const claimed = await claimLaunchMilestone(id, user.id);
	if (!claimed) return;
	globalClient.emit(
		Events.ServerNotification,
		`${launchFirst99Announcement(user.usernameOrMention, toTitleCase(skill))} Tag <@${LAUNCH_GIFT_OWNER_ID}> to claim a special gift for everyone!`
	);
	await notifyLaunchOwner(`First 99 ${toTitleCase(skill)}: ${user.usernameOrMention} (${user.id}). Time to spawn the community gift.`);
}

export async function maybeAnnounceLaunchFirstMax(user: MUser, maxedAccounts: number): Promise<void> {
	if (!isEventActive('launch')) return;
	if (await launchMilestoneExists(LAUNCH_MAX_MILESTONE_ID)) return;
	if (maxedAccounts > 1) {
		await claimLaunchMilestone(LAUNCH_MAX_MILESTONE_ID, 'already-reached');
		return;
	}
	const claimed = await claimLaunchMilestone(LAUNCH_MAX_MILESTONE_ID, user.id);
	if (!claimed) return;
	globalClient.emit(Events.ServerNotification, launchFirstMaxAnnouncement(user.usernameOrMention));
}
