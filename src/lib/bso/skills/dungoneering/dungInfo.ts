import {
	determineDgLevelForFloor,
	isValidFloor,
	MAX_DG_FLOOR,
	requiredLevel,
	requiredSkills
} from '@/lib/bso/skills/dungoneering/dungData.js';

import { customEmoji, objectEntries } from '@oldschoolgg/toolkit';

import type { SkillRequirements } from '@/lib/types/index.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';

export function formatDgFloorRequirements(floor: number): string {
	const combat = requiredLevel(floor);
	const skilling = Math.floor(combat / 1.5);
	const dungeoneering = determineDgLevelForFloor(floor);
	return `${combat} combat stats, ${skilling} skilling stats, ${dungeoneering} Dungeoneering`;
}

export function missingSkillRequirements(
	skills: SkillRequirements,
	requirements: SkillRequirements
): SkillRequirements {
	const missing: SkillRequirements = {};
	for (const [skill, required] of objectEntries(requirements)) {
		if (required === undefined) continue;
		const have = skills[skill] ?? 0;
		if (have < required) {
			missing[skill] = required;
		}
	}
	return missing;
}

export function formatMissingSkillRequirements(skills: SkillRequirements, requirements: SkillRequirements): string {
	const missing = missingSkillRequirements(skills, requirements);
	if (objectEntries(missing).length === 0) return 'No stats missing.';
	return formatSkillRequirements(missing);
}

export interface DgStatsMessageInput {
	tokens: number;
	maxFloor: number;
	meetsMaxFloorReqs: boolean;
	skills: SkillRequirements;
	gorajanBoosts: string[];
	requestedFloor?: number;
}

function floorRequirementLines(label: string, floor: number, skills: SkillRequirements): string[] {
	return [
		label,
		`**Required stats:** ${formatDgFloorRequirements(floor)}`,
		`**Missing stats:** ${formatMissingSkillRequirements(skills, requiredSkills(floor))}`
	];
}

export function formatDgStatsMessage(input: DgStatsMessageInput): string {
	const { tokens, maxFloor, meetsMaxFloorReqs, skills, gorajanBoosts, requestedFloor } = input;

	if (requestedFloor !== undefined && !isValidFloor(requestedFloor)) {
		return "That's an invalid floor.";
	}

	const lines = [
		`${customEmoji('dungeoneeringToken')} **Dungeoneering Tokens:** ${tokens.toLocaleString()}`,
		`**Max floor:** ${meetsMaxFloorReqs ? maxFloor : 'none yet'}`
	];

	if (gorajanBoosts.length > 0) {
		lines.push(`**Gorajan shard boosts:** ${gorajanBoosts.join(', ')}`);
	}

	if (requestedFloor !== undefined) {
		lines.push(...floorRequirementLines(`**Floor ${requestedFloor}:**`, requestedFloor, skills));
		const missing = missingSkillRequirements(skills, requiredSkills(requestedFloor));
		if (requestedFloor === MAX_DG_FLOOR && objectEntries(missing).length === 0) {
			lines.push("You're already on the highest floor.");
		}
		return lines.join('\n');
	}

	if (meetsMaxFloorReqs && maxFloor >= MAX_DG_FLOOR) {
		lines.push("You're already on the highest floor.");
		return lines.join('\n');
	}

	const floorToCheck = meetsMaxFloorReqs ? maxFloor + 1 : Math.max(1, maxFloor);
	const label = meetsMaxFloorReqs ? `**Next floor:** ${floorToCheck}` : `**Floor ${floorToCheck}:**`;
	lines.push(...floorRequirementLines(label, floorToCheck, skills));
	return lines.join('\n');
}
