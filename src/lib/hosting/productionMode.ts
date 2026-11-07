/**
 * Single production-mode check for this bot.
 *
 * The release-prep work should import `isProductionMode` (or read `globalConfig.isProduction`,
 * which calls this) instead of parsing `PRODUCTION` or `NODE_ENV` on its own.
 *
 * Precedence:
 * 1. `PRODUCTION`, when it is set to a recognised value
 * 2. `NODE_ENV === 'production'`
 *
 * Recognised true values: 1, true, yes, on. False: 0, false, no, off. A blank value is treated as unset.
 * Anything else throws, so a typo cannot silently boot the live bot in test mode.
 *
 * Merge note: if the other PR adds its own parser, delete that copy and import this module.
 */
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export function parseProductionFlag(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	const normalized = value.trim().toLowerCase();
	if (normalized === '') return undefined;
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	throw new Error(`PRODUCTION must be true or false, got ${JSON.stringify(value)}`);
}

export function isProductionMode(env: NodeJS.ProcessEnv = process.env): boolean {
	const explicit = parseProductionFlag(env.PRODUCTION);
	if (explicit !== undefined) return explicit;
	return env.NODE_ENV === 'production';
}
