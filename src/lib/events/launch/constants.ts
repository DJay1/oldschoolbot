export const LAUNCH_XP_BOOST_PERCENT = 25;

export const LAUNCH_XP_BONUS_SENTENCE = `You received ${LAUNCH_XP_BOOST_PERCENT}% bonus XP from the Launch event.`;

/** Text fallback until founder art exists. Still shown after the event ends. */
export const LAUNCH_FOUNDER_BADGE = '🏅';

export const LAUNCH_MAX_MILESTONE_ID = 'max';

export function launchSkill99Id(skill: string): string {
	return `99:${skill}`;
}

export function launchFirst99Announcement(username: string, skillName: string): string {
	return `🚀 **Launch:** ${username} is the first minion to reach level 99 in ${skillName}!`;
}

export function launchFirstMaxAnnouncement(username: string): string {
	return `🚀 **Launch:** ${username} is the first minion to max!`;
}
