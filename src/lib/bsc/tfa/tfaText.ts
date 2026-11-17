import { EmbedBuilder } from '@oldschoolgg/discord';

/** Discord rejects message content over 2,000 characters and embed descriptions over 4,096. */
export const DISCORD_CONTENT_LIMIT = 2000;
export const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;

/**
 * Never truncate: plain text if it fits, an embed if it fits there, otherwise a short note with the full text attached.
 */
export function fitDiscordMessage(text: string, title: string, preferEmbed = false) {
	if (!preferEmbed && text.length <= DISCORD_CONTENT_LIMIT) return text;
	if (text.length <= DISCORD_EMBED_DESCRIPTION_LIMIT) {
		return { embeds: [new EmbedBuilder().setTitle(title).setDescription(text)] };
	}
	return {
		content: `${title}: the full text is too long for one Discord message, so it's attached.`,
		files: [{ buffer: Buffer.from(text), name: 'result.txt' }]
	};
}

/** "90 Attack, Strength and Defence, 77 Prayer" instead of a line of emojis. */
export function compactSkillRequirements(reqs: Partial<Record<string, number>>) {
	const byLevel = new Map<number, string[]>();
	for (const [skill, level] of Object.entries(reqs)) {
		if (!level) continue;
		const name = skill.charAt(0).toUpperCase() + skill.slice(1);
		byLevel.set(level, [...(byLevel.get(level) ?? []), name]);
	}
	return [...byLevel.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([level, names]) => `${level} ${names.join('/')}`)
		.join(', ');
}

export interface TfaHelpData {
	raidName: string;
	kc: number;
	attempts: number;
	uniques: number;
	uniqueRate: string | null;
	notReady: string | null;
	soloWipe: number;
	streak: number;
	pityPercent: number;
	skillReqs: string;
	minGear: number;
	gear: { melee: number; range: number; mage: number };
	supplies: string;
	kcStep: number;
	pityPerWipe: number;
	pityCap: number;
	boostLines: string[];
	fragmentsUsed: number;
	roomsBoosted: number;
	yourBoosts: string;
	zeal: boolean;
}

export function buildTfaHelpText(d: TfaHelpData) {
	// Ready/not-ready goes right under the header so it can never be the part that gets lost.
	const status = d.notReady ? `\u26A0\uFE0F **Not ready:** ${d.notReady}` : '\u2705 You are ready to start a raid.';
	return `**${d.raidName}**
**KC:** ${d.kc} | **Attempts:** ${d.attempts} | **Uniques:** ${d.uniques}${d.uniqueRate ? ` (${d.uniqueRate})` : ''}
${status}
**Solo wipe chance:** ${d.soloWipe.toFixed(1)}% per raid${d.streak > 0 ? ` (${d.streak} wiped in a row, ${d.pityPercent}% pity)` : ''}

**Requirements**
- While Guthix Sleeps; ${d.skillReqs}
- ${d.minGear}%+ gear in melee, range and mage (yours: ${d.gear.melee.toFixed(1)}/${d.gear.range.toFixed(1)}/${d.gear.mage.toFixed(1)}%)
- Supplies per raid: ${d.supplies} (1 less Saradomin brew(4) per ${d.kcStep} KC, min 4)

**How it works**
5 bosses: Archive Guardian, Ezekiel or Bork and the Smorks, Moia or Dreadnoth the Jellied, The Dagon'hai or Xarth, then Ocellus. Team unique: 1/16 solo/duo, 1/7.5 at 8, awarded by contribution; others get 3 loot rolls. A full team wipe fails the raid (supplies lost); each wipe in a row cuts death chance ${d.pityPerWipe}% (max ${d.pityCap}%).

**Boosts**
${d.boostLines.map(b => `- ${b}`).join('\n')}
- Each used elemental fragment: 0.5% faster (${d.fragmentsUsed}/4)
- Room items: see \`/raid tfa rooms\` (you boost ${d.roomsBoosted} room${d.roomsBoosted === 1 ? '' : 's'})
**Yours:** ${d.yourBoosts} | **Zeal:** ${d.zeal ? 'Unlocked' : 'Locked'}`;
}
