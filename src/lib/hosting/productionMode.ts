/**
 * Single production-mode check for this bot.
 *
 * `globalConfig.isProduction` calls `isProductionMode`. Do not parse `PRODUCTION` or `NODE_ENV` anywhere else.
 * Instant trips, test commands, and admin-for-non-owners read this through `testingShortcutsEnabled()`.
 *
 * Precedence:
 * 1. `PRODUCTION`, when it is set to a recognised value
 * 2. `NODE_ENV === 'production'`
 *
 * Recognised true values: 1, true, yes, on. False: 0, false, no, off. A blank value is treated as unset.
 * Anything else throws, so a typo cannot silently boot the live bot in test mode.
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
