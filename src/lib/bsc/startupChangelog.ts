import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATE_FILE = '.last-start-hash';
const MAX_LINES = 15;

function git(args: string[]): string {
	return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 }).trim();
}

/** Prefer "Title (#24)" when the subject already has a PR number; otherwise leave as-is. */
export function formatChangelogSubject(subject: string): string {
	const cleaned = subject.replace(/^Merge pull request (#\d+) from .+$/i, 'Merge $1').trim();
	return cleaned;
}

/** Commit subjects since the last startup (for the restart notice). Empty when nothing changed. */
export function startupChangelogLines(): string[] {
	try {
		const head = git(['rev-parse', 'HEAD']);
		const file = join(process.cwd(), STATE_FILE);
		const prev = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
		writeFileSync(file, head);
		if (!prev || prev === head) return [];
		const subjects = git(['log', '--no-merges', '--format=%s', `${prev}..${head}`])
			.split('\n')
			.map(s => s.trim())
			.filter(s => s && !/^sync\b/i.test(s))
			.map(formatChangelogSubject);
		if (subjects.length === 0) return [];
		const shown = subjects.slice(0, MAX_LINES);
		if (subjects.length > MAX_LINES) shown.push(`...and ${subjects.length - MAX_LINES} more`);
		return shown;
	} catch {
		return [];
	}
}

/** @deprecated Prefer startupChangelogLines + embed. Kept for callers expecting a string. */
export function startupChangelog(): string {
	const lines = startupChangelogLines();
	if (lines.length === 0) return '';
	return `**What changed:**\n${lines.map(s => `- ${s}`).join('\n')}`.slice(0, 1500);
}
