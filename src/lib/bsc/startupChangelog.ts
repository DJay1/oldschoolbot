import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATE_FILE = '.last-start-hash';
const MAX_LINES = 20;
const DETAILS_FILE = 'CHANGELOG.startup.md';

function git(args: string[]): string {
	return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 }).trim();
}

/** Prefer "Title (#24)" when the subject already has a PR number; otherwise leave as-is. */
export function formatChangelogSubject(subject: string): string {
	const cleaned = subject.replace(/^Merge pull request (#\d+) from .+$/i, 'Merge $1').trim();
	return cleaned;
}

/** Pull `- ` / `* ` / `• ` bullet lines from a commit or file body (skip the subject line). */
export function extractBulletLines(body: string): string[] {
	const lines = body.replace(/\r\n/g, '\n').split('\n');
	const bullets: string[] = [];
	for (const raw of lines) {
		const m = raw.match(/^\s*[-*•]\s+(.+)$/);
		if (!m) continue;
		const text = m[1].trim();
		if (!text) continue;
		// Skip markdown checkbox / empty noise
		if (/^\[.\]\s/.test(text)) continue;
		bullets.push(text.replace(/\s+/g, ' '));
	}
	return bullets;
}

function bulletsFromCommitRange(prev: string, head: string): string[] {
	const raw = git(['log', '--no-merges', '--format=%B%x1e', `${prev}..${head}`]);
	if (!raw) return [];
	const out: string[] = [];
	for (const block of raw.split('\x1e')) {
		const trimmed = block.trim();
		if (!trimmed) continue;
		const [subjectLine, ...rest] = trimmed.split('\n');
		const subject = formatChangelogSubject(subjectLine.trim());
		if (!subject || /^sync\b/i.test(subject)) continue;
		const bodyBullets = extractBulletLines(rest.join('\n'));
		if (bodyBullets.length > 0) {
			out.push(...bodyBullets);
		} else {
			out.push(subject);
		}
	}
	return out;
}

function bulletsFromDetailsFile(prev: string, head: string): string[] | null {
	const path = join(process.cwd(), DETAILS_FILE);
	if (!existsSync(path)) return null;
	try {
		// Only use the file when it changed in this range (or is new)
		const changed = git(['diff', '--name-only', `${prev}..${head}`, '--', DETAILS_FILE]);
		if (!changed.includes(DETAILS_FILE) && !changed.includes(DETAILS_FILE.replace(/\\/g, '/'))) {
			// Still allow if file content has bullets and subjects alone were thin? Prefer only when changed.
			return null;
		}
	} catch {
		return null;
	}
	return extractBulletLines(readFileSync(path, 'utf8'));
}

/** Detailed change bullets since the last startup (for the restart notice). Empty when nothing changed. */
export function startupChangelogLines(): string[] {
	try {
		const head = git(['rev-parse', 'HEAD']);
		const file = join(process.cwd(), STATE_FILE);
		const prev = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
		writeFileSync(file, head);
		if (!prev || prev === head) return [];

		const fromFile = bulletsFromDetailsFile(prev, head);
		const lines = fromFile && fromFile.length > 0 ? fromFile : bulletsFromCommitRange(prev, head);
		if (lines.length === 0) return [];

		const shown = lines.slice(0, MAX_LINES);
		if (lines.length > MAX_LINES) shown.push(`+${lines.length - MAX_LINES} more`);
		return shown;
	} catch {
		return [];
	}
}

/** @deprecated Prefer startupChangelogLines + embed. Kept for callers expecting a string. */
export function startupChangelog(): string {
	const lines = startupChangelogLines();
	if (lines.length === 0) return '';
	return `**What changed:**\n${lines.map(s => `- ${s}`).join('\n')}`.slice(0, 3500);
}
