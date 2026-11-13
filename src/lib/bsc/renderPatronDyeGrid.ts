import type { Item } from 'oldschooljs';

import { PATRON_DYE_PREVIEW_NOTE, PATRON_DYES, type PatronItemDye } from '@/lib/bsc/patronDyes.js';
import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

function previewDye(itemID: number, dye: (typeof PATRON_DYES)[number]): PatronItemDye {
	return {
		itemID,
		dyeKey: dye.key,
		mode: 'recolour_glow',
		// Show sparkles on Golden Corgo in the preview so the optional effect is visible.
		sparkle: dye.customizable ? true : dye.sparkles
	};
}

export async function renderPatronDyeGrid({ item }: { item: Item }): Promise<Buffer> {
	if (!bankImageTask.ready) {
		await bankImageTask.init();
		bankImageTask.ready = true;
	}

	const cols = 5;
	const rows = 1;
	const titleHeight = 21;
	const titleGap = 8;
	const glowPad = 16;
	const itemSlotWidth = 36;
	const itemSlotHeight = 32;
	const labelHeight = 16;
	const footerHeight = 28;
	const bottomPad = 10;
	const tileWidth = 488 / cols;
	const tileHeight = glowPad + itemSlotHeight + glowPad + labelHeight;
	const canvasWidth = 488;
	const canvasHeight = titleHeight + titleGap + rows * tileHeight + footerHeight + bottomPad;

	const { sprite } = bankImageTask.getBgAndSprite({
		bankBackgroundId: 1
	});
	const canvas = new OSRSCanvas({ width: canvasWidth, height: canvasHeight, sprite });
	const ctx = canvas.ctx;
	ctx.fillStyle = ctx.createPattern(sprite.repeatableBg, 'repeat')!;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	canvas.drawBorder(sprite, true);

	canvas.drawTitleText({
		text: `Dye Preview for ${item.name}`,
		x: Math.floor(canvas.width / 2),
		y: titleHeight,
		center: true
	});

	for (let i = 0; i < PATRON_DYES.length; i++) {
		const dye = PATRON_DYES[i];
		const col = i % cols;
		const row = Math.floor(i / cols);
		const tileX = col * tileWidth;
		const tileY = titleHeight + titleGap + row * tileHeight;
		const iconX = tileX + (tileWidth - itemSlotWidth) / 2;
		const iconY = tileY + glowPad;

		await canvas.drawItemIDSprite({
			itemID: item.id,
			x: iconX,
			y: iconY,
			patronDyeOverride: previewDye(item.id, dye)
		});

		const bottle = await OSRSCanvas.getItemImage({ itemID: dye.itemID });
		const bucketWidth = bottle.width / 2;
		const bucketHeight = bottle.height / 2;
		ctx.drawImage(
			bottle,
			iconX + itemSlotWidth - bucketWidth / 2,
			iconY + itemSlotHeight - bucketHeight / 2,
			bucketWidth,
			bucketHeight
		);

		canvas.drawText({
			text: dye.name,
			x: Math.floor(tileX + tileWidth / 2),
			y: Math.floor(iconY + itemSlotHeight + glowPad + 2),
			color: OSRSCanvas.COLORS.YELLOW,
			center: true,
			font: 'Bold'
		});
	}

	canvas.drawText({
		text: PATRON_DYE_PREVIEW_NOTE,
		x: Math.floor(canvas.width / 2),
		y: canvasHeight - bottomPad - 4,
		color: OSRSCanvas.COLORS.YELLOW,
		center: true,
		font: 'Bold'
	});

	return canvas.toScaledOutput(2);
}

