import { type Bank, ItemGroups, resolveItems, toKMB } from 'oldschooljs';

import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { type CanvasImage, loadImage } from '@/lib/canvas/canvasUtil.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { TOBUniques } from '@/lib/data/tob.js';
import { getNewClGlowColour } from '@/lib/util/newClGlowColour.js';

export const chestLootTypes: {
	title: string;
	chestImage: Promise<CanvasImage>;
	chestImagePurple: Promise<CanvasImage>;
	width: number;
	height: number;
	purpleItems: (number | string)[];
	position: (canvas: OSRSCanvas, image: CanvasImage) => [number, number];
	itemRect: [number, number, number, number];
	/** Draw a purple frame around a panel that got a purple. */
	purpleBorder?: boolean;
	growWithItems?: boolean;
}[] = [
	{
		title: 'Tombs of Amascut',
		chestImage: loadImage('./src/lib/resources/images/toaChest.png'),
		chestImagePurple: loadImage('./src/lib/resources/images/toaChestPurple.png'),
		width: 240,
		height: 220,
		purpleItems: ItemGroups.toaPurpleItems,
		position: (canvas: OSRSCanvas, image: CanvasImage) => [
			canvas.width - image.width + 25,
			44 + canvas.height / 4 - image.height / 2
		],
		itemRect: [21, 50, 120, 160]
	},
	{
		title: 'Theatre of Blood',
		chestImage: loadImage('./src/lib/resources/images/tobChest.png'),
		chestImagePurple: loadImage('./src/lib/resources/images/tobChestPurple.png'),
		width: 260,
		height: 180,
		purpleItems: TOBUniques,
		position: (canvas: OSRSCanvas, image: CanvasImage) => [
			canvas.width - image.width,
			55 + canvas.height / 4 - image.height / 2
		],
		itemRect: [21, 50, 120, 160]
	},
	{
		title: 'Chambers of Xerician',
		chestImage: loadImage('./src/lib/resources/images/cox.png'),
		chestImagePurple: loadImage('./src/lib/resources/images/cox.png'),
		width: 260,
		height: 180,
		purpleItems: resolveItems([
			'Metamorphic dust',
			'Twisted ancestral colour kit',
			"Xeric's guard",
			"Xeric's warrior",
			"Xeric's sentinel",
			"Xeric's general",
			"Xeric's champion",
			'Olmlet',
			'Twisted bow',
			'Elder maul',
			'Kodai insignia',
			'Dragon claws',
			'Ancestral hat',
			'Ancestral robe top',
			'Ancestral robe bottom',
			"Dinh's bulwark",
			'Dexterous prayer scroll',
			'Arcane prayer scroll',
			'Dragon hunter crossbow',
			'Twisted buckler'
		]),
		position: () => [12, 44],
		itemRect: [135, 45, 120, 120]
	},
	{
		title: 'Depths of Atlantis',
		chestImage: loadImage('./src/lib/resources/images/doa.png'),
		chestImagePurple: loadImage('./src/lib/resources/images/doa.png'),
		width: 260,
		height: 180,
		purpleItems: [70420, 70441, 70425, 70426, 70428, 70437, 70438, 70439, 70440],
		position: () => [12, 44],
		itemRect: [135, 45, 120, 120]
	},
	{
		title: 'The Fractured Archive',
		chestImage: loadImage('./src/lib/resources/images/tfa.png'),
		// OSRS wiki art: normal loot = the opened standard chest (Rift, mine); purple = the opened unique chest.
		chestImagePurple: loadImage('./src/lib/resources/images/tfaPurple.png'),
		width: 260,
		height: 180,
		purpleBorder: true,
		// Multi-raid trips roll lots of items, so the panel grows taller instead of skipping the image.
		growWithItems: true,
		// Rondache, Zorya's tome, Horn of Bran, Ascension crossbows, Obligator, Orion
		purpleItems: [74600, 74601, 74602, 74603, 74604, 74611],
		position: () => [12, 44],
		itemRect: [135, 45, 120, 120]
	}
] as const;

/** True when the loot has any of the raid's purple-tier items. */
export function chestLootIsPurple(loot: Bank, purpleItems: readonly (number | string)[]): boolean {
	return loot.items().some(([item]) => purpleItems.includes(item.id));
}

/** Item rows drawn 2 per row; each extra row past the base 3 adds this many pixels. */
const CHEST_ROW_HEIGHT = 42;
const CHEST_BASE_ROWS = 3;

/** Panel height for this loot. Fixed for most raids; grows with the item count for raids flagged growWithItems. */
export function chestCanvasHeight(type: (typeof chestLootTypes)[number], itemCount: number): number {
	if (!type.growWithItems) return type.height;
	const rows = Math.ceil(itemCount / 2);
	return type.height + Math.max(0, rows - CHEST_BASE_ROWS) * CHEST_ROW_HEIGHT;
}

export const chestPurpleItemsFor = (title: string) => chestLootTypes.find(t => t.title === title)?.purpleItems ?? [];

interface CustomText {
	x: number;
	y: number;
	text: string;
}

interface ChestLootEntry {
	previousCL: Bank;
	user: MUser;
	loot: Bank;
	customTexts: CustomText[];
}

async function drawSingleChestCanvas(
	entry: ChestLootEntry,
	type: (typeof chestLootTypes)[number]
): Promise<{ canvas: OSRSCanvas; isPurple: boolean }> {
	if (!bankImageTask.ready) {
		await bankImageTask.init();
		bankImageTask.ready = true;
	}
	const { previousCL, loot, user, customTexts } = entry;
	const { sprite } = bankImageTask.getBgAndSprite({ bankBackgroundId: user.user.bankBackground });

	const canvas = new OSRSCanvas({
		width: type.width,
		height: chestCanvasHeight(type, loot.length),
		sprite,
		iconPackId: user.iconPackId
	});

	canvas.ctx.fillStyle = canvas.ctx.createPattern(sprite.repeatableBg, 'repeat')!;
	canvas.ctx.fillRect(0, 0, canvas.width, canvas.height);

	const isPurple = chestLootIsPurple(loot, type.purpleItems);
	const chestImage = isPurple ? await type.chestImagePurple : await type.chestImage;
	const [x, y] = type.position(canvas, chestImage);

	canvas.ctx.drawImage(chestImage, x, y);

	canvas.drawTitleText({
		text: `${user.username} (${toKMB(loot.value())})`,
		x: canvas.width / 2,
		y: 21,
		center: true
	});

	canvas.drawBorder(sprite, true);

	if (isPurple && type.purpleBorder) {
		canvas.ctx.save();
		canvas.ctx.strokeStyle = 'rgba(190, 80, 255, 0.85)';
		canvas.ctx.lineWidth = 2;
		canvas.ctx.shadowColor = '#c050ff';
		canvas.ctx.shadowBlur = 6;
		canvas.ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
		canvas.ctx.restore();
	}

	await drawChestItems(canvas, loot, previousCL, user, type);

	for (const customText of customTexts) {
		canvas.drawText({
			text: customText.text,
			x: customText.x,
			y: customText.y,
			color: '#FFFF00'
		});
	}

	return { canvas, isPurple };
}

async function drawChestItems(
	canvas: OSRSCanvas,
	loot: Bank,
	previousCL: Bank,
	user: MUser,
	type: (typeof chestLootTypes)[number]
): Promise<void> {
	const xOffset = 10;
	const yOffset = 45;
	const [iX, iY, iW, iH] = type.itemRect;

	const extraHeight = chestCanvasHeight(type, loot.length) - type.height;
	const itemCanvas = new OSRSCanvas({ width: iW + xOffset, height: iH + yOffset + extraHeight });

	await bankImageTask.drawItems(
		itemCanvas,
		false, // compact
		5, // spacer
		2, // itemsPerRow
		55, // itemWidthSize
		loot.items(),
		new Map().set('showNewCL', true),
		previousCL,
		undefined, // mahojiFlags
		undefined, // weightings
		5, // verticalSpacer
		user,
		await getNewClGlowColour(user)
	);

	// Draw the item canvas onto the main canvas
	canvas.ctx.drawImage(itemCanvas.getCanvas(), iX - xOffset, iY - yOffset);
}

function combineCanvases(canvases: OSRSCanvas[]): OSRSCanvas {
	const spaceBetweenImages = 15;
	const totalWidth = canvases[0].width * canvases.length + spaceBetweenImages * canvases.length;
	const totalHeight = Math.max(...canvases.map(c => c.height));

	const combinedCanvas = new OSRSCanvas({
		width: totalWidth,
		height: totalHeight,
		sprite: canvases[0].sprite
	});

	for (const [index, canvas] of canvases.entries()) {
		const xPosition = index * canvas.width + spaceBetweenImages * index;
		combinedCanvas.ctx.drawImage(canvas.getCanvas(), xPosition, 0);
	}

	return combinedCanvas;
}

export interface DrawChestLootImageOptions {
	entries: ChestLootEntry[];
	type: (typeof chestLootTypes)[number]['title'];
}
export async function drawChestLootImage(options: DrawChestLootImageOptions): Promise<SendableFile> {
	const type = chestLootTypes.find(t => t.title === options.type);
	if (!type) {
		throw new Error(`Invalid chest type: ${options.type}`);
	}

	const canvasResults: { canvas: OSRSCanvas; isPurple: boolean }[] = [];

	for (const entry of options.entries) {
		const result = await drawSingleChestCanvas(entry, type);
		canvasResults.push(result);
	}

	const anyoneGotPurple = canvasResults.some(result => result.isPurple);
	const fileName = `${anyoneGotPurple ? 'SPOILER_' : ''}${type.title.toLowerCase().replace(/\s+/g, '')}-${Date.now()}.png`;

	if (canvasResults.length === 1) {
		const imageBuffer = await canvasResults[0].canvas.toBuffer();
		return { name: fileName, buffer: imageBuffer };
	}

	const canvases = canvasResults.map(result => result.canvas);
	const combinedCanvas = combineCanvases(canvases);
	const combinedBuffer = await combinedCanvas.toBuffer();

	return { name: fileName, buffer: combinedBuffer };
}
