import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';

export const minionBuyButton = new ButtonBuilder()
	.setCustomId('BUY_MINION')
	.setLabel('Buy Minion')
	.setStyle(ButtonStyle.Success);
