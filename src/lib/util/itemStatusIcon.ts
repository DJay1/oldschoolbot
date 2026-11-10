import { customEmoji } from '@oldschoolgg/toolkit';

/**
 * Application emoji if it has been synced, otherwise an empty string.
 * Never returns a unicode/text fallback that can render as a broken icon.
 */
export function itemStatusIcon(name: string): string {
	const icon = customEmoji(name);
	return icon.startsWith('<') ? `${icon} ` : '';
}
