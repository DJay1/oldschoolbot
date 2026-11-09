import { EmbedBuilder } from '@oldschoolgg/discord';
import { hexToDecimal, isValidHexColor, PerkTier } from '@oldschoolgg/toolkit';

import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { patronMsg } from '@/lib/util/smallUtils.js';

export const DEFAULT_NEW_CL_GLOW_COLOUR = OSRSCanvas.COLORS.PURPLE;
export const NEW_CL_GLOW_PERK_TIER = PerkTier.Four;

export async function getNewClGlowColour(user: MUser | null | undefined): Promise<string> {
	const custom = user?.user.new_cl_glow_hex;
	if (!custom) return DEFAULT_NEW_CL_GLOW_COLOUR;
	if ((await user.fetchPerkTier()) < NEW_CL_GLOW_PERK_TIER) return DEFAULT_NEW_CL_GLOW_COLOUR;
	return custom;
}

export async function newClGlowColourCommand(user: MUser, colour?: string | null) {
	const current = user.user.new_cl_glow_hex;

	if (colour?.trim().toLowerCase() === 'reset') {
		await user.update({ new_cl_glow_hex: null });
		return `Your new collection log glow is back to the default purple (\`${DEFAULT_NEW_CL_GLOW_COLOUR}\`).`;
	}

	if (!colour) {
		const shown = current ?? DEFAULT_NEW_CL_GLOW_COLOUR;
		return {
			embeds: [
				new EmbedBuilder()
					.setColor(hexToDecimal(shown))
					.setDescription(
						current
							? `Your new collection log glow colour is \`${current}\`.`
							: `You're using the default purple glow (\`${DEFAULT_NEW_CL_GLOW_COLOUR}\`).`
					)
			]
		};
	}

	if ((await user.fetchPerkTier()) < NEW_CL_GLOW_PERK_TIER) return patronMsg(NEW_CL_GLOW_PERK_TIER);

	let hex = colour.trim().toUpperCase();
	if (!hex.startsWith('#')) hex = `#${hex}`;
	if (!isValidHexColor(hex)) {
		return "That's not a valid hex colour. It needs to be 6 characters, like `#4E42F5` - use this to pick one: <https://www.google.com/search?q=hex+color+picker>";
	}

	await user.update({ new_cl_glow_hex: hex });
	return {
		embeds: [
			new EmbedBuilder()
				.setColor(hexToDecimal(hex))
				.setDescription(`New collection log items in your bank images will now glow \`${hex}\`.`)
		]
	};
}
