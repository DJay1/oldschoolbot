import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATE_FILE = '.last-start-hash';
const MAX_LINES = 15;

function git(args: string[]): string {
	return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 }).trim();
}

/** Commit subjects since the last startup, for the restart notice. Empty when nothing changed or git is unavailable. */
export function startupChangelog(): string {
	try {
		const head = git(['rev-parse', 'HEAD']);
		const file = join(process.cwd(), STATE_FILE);
		const prev = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
		writeFileSync(file, head);
		if (!prev || prev === head) return '';
		const subjects = git(['log', '--no-merges', '--format=%s', `${prev}..${head}`])
			.split('\n')
			.map(s => s.trim())
			.filter(s => s && !/^sync\b/i.test(s));
		if (subjects.length === 0) return '';
		const shown = subjects.slice(0, MAX_LINES).map(s => `- ${s}`);
		if (subjects.length > MAX_LINES) shown.push(`- ...and ${subjects.length - MAX_LINES} more`);
		return `**What changed:**\n${shown.join('\n')}`.slice(0, 1500);
	} catch {
		return '';
	}
}
