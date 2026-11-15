import type { APIApplicationCommandOption } from '@oldschoolgg/discord';
import { describe, expect, test } from 'vitest';

import { convertCommandOptionToAPIOption } from '@/discord/commands/commandOptionConversions.js';
import { allCommandsDONTIMPORT } from '@/mahoji/commands/allCommands.js';

/**
 * Discord rejects the whole bulk command registration if any one command breaks a limit
 * (e.g. BASE_TYPE_BAD_LENGTH), so every command, including dev-only and event ones, is checked here.
 */
const NAME_RE = /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;
const MAX_DESCRIPTION = 100;
const MAX_OPTIONS = 25;
const MAX_CHOICES = 25;
const MAX_CHOICE_NAME = 100;
const MAX_CHOICE_STRING_VALUE = 100;

function checkName(path: string, name: string, problems: string[]) {
	if (!NAME_RE.test(name) || name !== name.toLowerCase())
		problems.push(`${path}: bad name "${name}" (1-32 lowercase chars)`);
}

function checkDescription(path: string, description: unknown, problems: string[]) {
	if (typeof description !== 'string' || description.length < 1 || description.length > MAX_DESCRIPTION) {
		problems.push(
			`${path}: description length ${typeof description === 'string' ? description.length : 'missing'} (must be 1-${MAX_DESCRIPTION})`
		);
	}
}

function checkOptions(path: string, options: readonly APIApplicationCommandOption[] | undefined, problems: string[]) {
	if (!options) return;
	if (options.length > MAX_OPTIONS) problems.push(`${path}: ${options.length} options (max ${MAX_OPTIONS})`);
	const seen = new Set<string>();
	let optionalSeen = false;
	for (const opt of options) {
		const p = `${path} > ${opt.name}`;
		checkName(p, opt.name, problems);
		checkDescription(p, opt.description, problems);
		if (seen.has(opt.name)) problems.push(`${p}: duplicate option name`);
		seen.add(opt.name);
		const sub = (opt as { options?: APIApplicationCommandOption[] }).options;
		if (sub) checkOptions(p, sub, problems);
		const required = (opt as { required?: boolean }).required === true;
		if (!sub) {
			if (required && optionalSeen) problems.push(`${p}: required option after an optional one`);
			if (!required) optionalSeen = true;
		}
		const choices = (opt as { choices?: { name: string; value: string | number }[] }).choices;
		if (choices) {
			if (choices.length > MAX_CHOICES) problems.push(`${p}: ${choices.length} choices (max ${MAX_CHOICES})`);
			for (const c of choices) {
				if (c.name.length < 1 || c.name.length > MAX_CHOICE_NAME) {
					problems.push(`${p}: choice name length ${c.name.length} "${c.name.slice(0, 40)}..."`);
				}
				if (typeof c.value === 'string' && (c.value.length < 1 || c.value.length > MAX_CHOICE_STRING_VALUE)) {
					problems.push(`${p}: choice value length ${c.value.length}`);
				}
			}
		}
	}
}

describe('slash command registration limits', () => {
	// Runs in its own config (vitest.commands.config.mts): loading every command pulls in most of the bot,
	// which would break vi.mock in the shared-module unit suite.
	test('every command fits Discord limits', () => {
		const problems: string[] = [];
		const names = new Set<string>();
		expect(allCommandsDONTIMPORT.length).toBeGreaterThan(0);
		for (const cmd of allCommandsDONTIMPORT) {
			const path = `/${cmd.name}`;
			checkName(path, cmd.name, problems);
			checkDescription(path, cmd.description, problems);
			if (names.has(cmd.name)) problems.push(`${path}: duplicate command name`);
			names.add(cmd.name);
			checkOptions(path, cmd.options.map(convertCommandOptionToAPIOption), problems);
		}
		expect(problems).toEqual([]);
	});
});
