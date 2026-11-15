import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Double XP timing guard (see docs/anti-exploit-checklist.md, "Double XP / Double Loot timing").
 * Trip handlers must pass the trip `duration` to addXP / addXPCounter, so a trip that overlapped
 * Double XP at any point is doubled (doubleXp.ts isDoubleXpActive, addXP.ts doubleXpApplied).
 *
 * Needs PR #47 (raid, ToB, DoA, quest, Forestry and burying fixes) merged first.
 * KNOWN_MISSING_DURATION lists the current offenders (file -> number of calls without duration).
 * TODO: remove each entry as it is fixed. This test fails if a file gets a NEW call without duration,
 * and also fails if a file has FEWER than listed, so the list is shrunk as fixes land.
 */
const KNOWN_MISSING_DURATION: Record<string, number> = {
	// TODO: woodcutting and herblore XP from farming (cleaning herbs / clearing trees)
	'src/tasks/minions/farmingStep.ts': 2
};

/** TODO: remove as fixed. file -> number of back-to-back addXP calls with the same skill and amount. */
const KNOWN_DUPLICATE_XP: Record<string, number> = {};

const ROOTS = ['src/tasks', 'src/lib/bso/tasks'];

function walk(dir: string, out: string[] = []): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (p.endsWith('.ts')) out.push(p.replace(/\\/g, '/'));
	}
	return out;
}

type Call = { start: number; end: number; arg: string };

function findCalls(src: string): Call[] {
	const out: Call[] = [];
	const re = /\.(addXP|addXPCounter)\(/g;
	let m: RegExpExecArray | null = re.exec(src);
	while (m) {
		let i = m.index + m[0].length;
		let depth = 1;
		while (i < src.length && depth > 0) {
			const ch = src[i];
			if (ch === '(' || ch === '{' || ch === '[') depth++;
			else if (ch === ')' || ch === '}' || ch === ']') depth--;
			i++;
		}
		out.push({ start: m.index, end: i, arg: src.slice(m.index + m[0].length, i - 1).trim() });
		m = re.exec(src);
	}
	return out;
}

/** The object text passed in: inline, or a `const name = { ... }` in the same file. */
function argObject(src: string, arg: string): string {
	if (!/^[A-Za-z_$][\w$]*$/.test(arg)) return arg;
	const decl = new RegExp(`(?:const|let)\\s+${arg}\\s*(?::[^=]+)?=\\s*\\{`).exec(src);
	if (!decl) return arg;
	let i = decl.index + decl[0].length;
	let depth = 1;
	while (i < src.length && depth > 0) {
		if (src[i] === '{') depth++;
		else if (src[i] === '}') depth--;
		i++;
	}
	return src.slice(decl.index, i);
}

function field(obj: string, name: string): string | null {
	const m = new RegExp(`\\b${name}\\s*:\\s*([^,}\\n]+)`).exec(obj);
	return m ? m[1].trim() : null;
}

const cwd = process.cwd();
const files = ROOTS.flatMap(r => walk(path.join(cwd, r))).map(f => path.relative(cwd, f).replace(/\\/g, '/'));

describe('Double XP timing guard', () => {
	test('trip handlers pass duration to addXP (no new offenders)', () => {
		const found: Record<string, number> = {};
		for (const file of files) {
			const src = readFileSync(path.join(cwd, file), 'utf8');
			for (const call of findCalls(src)) {
				const obj = argObject(src, call.arg);
				if (!/\bduration\b/.test(obj) && !/\.\.\./.test(obj)) found[file] = (found[file] ?? 0) + 1;
			}
		}
		const problems: string[] = [];
		for (const [file, count] of Object.entries(found)) {
			const allowed = KNOWN_MISSING_DURATION[file] ?? 0;
			if (count > allowed)
				problems.push(
					`${file}: ${count} addXP calls without duration (allowed ${allowed}). Pass the trip duration.`
				);
		}
		for (const [file, allowed] of Object.entries(KNOWN_MISSING_DURATION)) {
			const count = found[file] ?? 0;
			if (count < allowed)
				problems.push(`${file}: fixed (${count}/${allowed}). Lower or remove it in KNOWN_MISSING_DURATION.`);
		}
		expect(problems).toEqual([]);
	});

	test('no back-to-back addXP calls with the same skill and amount', () => {
		const found: Record<string, number> = {};
		for (const file of files) {
			const src = readFileSync(path.join(cwd, file), 'utf8');
			const calls = findCalls(src);
			for (let i = 1; i < calls.length; i++) {
				const a = argObject(src, calls[i - 1].arg);
				const b = argObject(src, calls[i].arg);
				const between = src.slice(calls[i - 1].end, calls[i].start);
				if (between.length > 400 || /\bfunction\b|=>/.test(between)) continue;
				const skillA = field(a, 'skillName');
				const amountA = field(a, 'amount');
				if (skillA && amountA && skillA === field(b, 'skillName') && amountA === field(b, 'amount')) {
					found[file] = (found[file] ?? 0) + 1;
				}
			}
		}
		const problems: string[] = [];
		for (const [file, count] of Object.entries(found)) {
			const allowed = KNOWN_DUPLICATE_XP[file] ?? 0;
			if (count > allowed) problems.push(`${file}: ${count} duplicate addXP calls (allowed ${allowed}).`);
		}
		for (const [file, allowed] of Object.entries(KNOWN_DUPLICATE_XP)) {
			if ((found[file] ?? 0) < allowed) problems.push(`${file}: fixed. Remove it from KNOWN_DUPLICATE_XP.`);
		}
		expect(problems).toEqual([]);
	});
});
