import { access, constants } from 'node:fs/promises';
import { CanvasModule } from '@/lib/canvas/CanvasModule.js';
import { type CanvasImage, createCanvas, loadImage } from '@/lib/canvas/canvasUtil.js';
import type { IconPackID } from '@/lib/canvas/iconPacks.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { type Bank, Items } from 'oldschooljs';

/** Drop DJ art here; missing files fall back to solid panel colours. */
export const CRACKER_WINNER_BG_PATH = './assets/images/cracker_winner_bg.jpg';
export const CRACKER_LOSER_BG_PATH = './assets/images/cracker_loser_bg.jpg';

/** Dual-mode panel size (solo left panel is wider: cardWidth - 20). */
export const CRACKER_PANEL_WIDTH = 205;
export const CRACKER_PANEL_HEIGHT = 128;

const corgoPromise: Promise<CanvasImage> = loadImage('./assets/emojis/esbcorgi.png');

let winnerBgPromise: Promise<CanvasImage | null> | null = null;
let loserBgPromise: Promise<CanvasImage | null> | null = null;

async function loadOptionalImage(path: string): Promise<CanvasImage | null> {
	try {
		await access(path, constants.R_OK);
		return await loadImage(path);
	} catch {
		return null;
	}
}

function winnerBg(): Promise<CanvasImage | null> {
	winnerBgPromise ??= loadOptionalImage(CRACKER_WINNER_BG_PATH);
	return winnerBgPromise;
}

function loserBg(): Promise<CanvasImage | null> {
	loserBgPromise ??= loadOptionalImage(CRACKER_LOSER_BG_PATH);
	return loserBgPromise;
}

function firstEntry(bank: Bank): { id: number; name: string; qty: number } | null {
	const entries = bank.items();
	if (entries.length === 0) return null;
	const [item, qty] = entries[0];
	return { id: item.id, name: item.name, qty };
}

function truncateName(name: string, max = 16): string {
	const clean = name.replace(/[^\w ._\-']/g, '').trim() || 'Unknown';
	return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function fillRoundRect(
	ctx: OSRSCanvas['ctx'],
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	const radius = Math.max(0, Math.min(r, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
	ctx.fill();
}

function strokeRoundRect(
	ctx: OSRSCanvas['ctx'],
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	const radius = Math.max(0, Math.min(r, w / 2, h / 2));
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
	ctx.stroke();
}

/** Scale-to-cover and center-crop into the panel rect (keeps side corgis). */
function drawCoverImage(
	ctx: OSRSCanvas['ctx'],
	img: CanvasImage,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const scale = Math.max(w / img.width, h / img.height);
	const dw = img.width * scale;
	const dh = img.height * scale;
	const dx = x + (w - dw) / 2;
	const dy = y + (h - dh) / 2;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	ctx.drawImage(img, dx, dy, dw, dh);
	ctx.restore();
}


/** Mean relative luminance of opaque sprite pixels (0=black, 1=white). */
function averageOpaqueLuminance(img: CanvasImage | { width: number; height: number }): number {
	const w = Math.max(1, Math.floor(img.width));
	const h = Math.max(1, Math.floor(img.height));
	const tmp = createCanvas(w, h);
	const ctx = tmp.getContext('2d');
	ctx.drawImage(img as CanvasImage, 0, 0);
	const data = ctx.getImageData(0, 0, w, h).data;
	let sum = 0;
	let n = 0;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 40) continue;
		const r = data[i] / 255;
		const g = data[i + 1] / 255;
		const b = data[i + 2] / 255;
		sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
		n++;
	}
	return n === 0 ? 0.5 : sum / n;
}

export interface CrackerWhoWonOptions {
	ownerName: string;
	otherName: string;
	winnerName: string;
	loserName: string;
	winnerLoot: Bank;
	loserLoot: Bank;
	/** When true, only the winner panel is shown (ironman solo pull). */
	solo?: boolean;
	iconPackId?: IconPackID | null;
}

/**
 * Reusable cracker result card. Layout is fixed; item slots are filled at
 * render time via drawItemIDSprite(itemID) — same sprite path bank/loot images use.
 * Optional panel backgrounds: assets/images/cracker_{winner,loser}_bg.jpg
 */
export async function makeCrackerWhoWonImage(opts: CrackerWhoWonOptions): Promise<SendableFile> {
	await CanvasModule.waitTillReady();

	const solo = opts.solo === true;
	const width = solo ? 260 : 440;
	const height = 188;
	const canvas = new OSRSCanvas({
		width,
		height,
		iconPackId: opts.iconPackId ?? undefined
	});

	canvas.ctx.fillStyle = OSRSCanvas.COLORS.LIGHT_CHOCOLATE;
	canvas.ctx.fillRect(0, 0, canvas.width, canvas.height);
	canvas.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
	canvas.ctx.fillRect(0, 0, canvas.width, canvas.height);

	const cracker = Items.getOrThrow('Christmas cracker');
	await canvas.drawItemIDSprite({
		itemID: cracker.id,
		x: 10,
		y: 6,
		iconPackId: opts.iconPackId ?? undefined
	});
	canvas.drawTitleText({ text: 'Christmas cracker!', x: 52, y: 28 });

	const corgo = await corgoPromise;
	const corgoScale = 28 / Math.max(corgo.width, corgo.height);
	const corgoW = Math.max(1, Math.floor(corgo.width * corgoScale));
	const corgoH = Math.max(1, Math.floor(corgo.height * corgoScale));
	canvas.ctx.drawImage(corgo, canvas.width - corgoW - 10, 8, corgoW, corgoH);

	const panelTop = 46;
	const panelHeight = CRACKER_PANEL_HEIGHT;
	const leftPanelW = solo ? width - 20 : CRACKER_PANEL_WIDTH;

	await drawPlayerPanel(canvas, {
		x: 10,
		y: panelTop,
		w: leftPanelW,
		h: panelHeight,
		label: 'WINNER',
		name: opts.winnerName,
		loot: opts.winnerLoot,
		highlight: true,
		bg: await winnerBg(),
		iconPackId: opts.iconPackId
	});

	if (!solo) {
		await drawPlayerPanel(canvas, {
			x: 225,
			y: panelTop,
			w: CRACKER_PANEL_WIDTH,
			h: panelHeight,
			label: 'Also pulled',
			name: opts.loserName,
			loot: opts.loserLoot,
			highlight: false,
			bg: await loserBg(),
			iconPackId: opts.iconPackId
		});
	}

	return {
		name: 'cracker-who-won.png',
		buffer: await canvas.toBuffer()
	};
}

async function drawPlayerPanel(
	canvas: OSRSCanvas,
	opts: {
		x: number;
		y: number;
		w: number;
		h: number;
		label: string;
		name: string;
		loot: Bank;
		highlight: boolean;
		bg: CanvasImage | null;
		iconPackId?: IconPackID | null;
	}
) {
	const { x, y, w, h, label, name, loot, highlight, bg, iconPackId } = opts;

	if (bg) {
		drawCoverImage(canvas.ctx, bg, x, y, w, h);
		// Slight darken so labels stay readable over busy art
		canvas.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
		canvas.ctx.fillRect(x, y, w, h);
	} else {
		canvas.ctx.fillStyle = highlight ? 'rgba(120, 90, 20, 0.55)' : 'rgba(0, 0, 0, 0.35)';
		canvas.ctx.fillRect(x, y, w, h);
	}
	canvas.drawHollowSquare(x, y, w, h, highlight ? OSRSCanvas.COLORS.YELLOW : '#2a241c');

	canvas.drawText({
		text: label,
		x: x + w / 2,
		y: y + 16,
		font: 'Bold',
		color: highlight ? OSRSCanvas.COLORS.YELLOW : OSRSCanvas.COLORS.ORANGE,
		center: true
	});

	canvas.drawText({
		text: truncateName(name),
		x: x + w / 2,
		y: y + 34,
		font: 'Compact',
		color: OSRSCanvas.COLORS.WHITE,
		center: true
	});

	const entry = firstEntry(loot);
	if (!entry) return;

	const itemX = x + Math.floor((w - canvas.itemSize.width) / 2);
	const itemY = y + 46;

	// Dark rounded plate so the sprite stays readable over panel backgrounds.
	const padX = 8;
	const padY = 6;
	const plateX = itemX - padX;
	const plateY = itemY - padY;
	const plateW = canvas.itemSize.width + padX * 2;
	const plateH = canvas.itemSize.height + padY * 2;
	const plateR = 8;

	// Also pulled: keep the dark plate DJ already likes.
	// Winner: pick plate + 1px sprite outline from sprite luminance so both
	// dark (Blue partyhat) and light (White partyhat) items stay readable.
	let winnerOutline: { outlineColor: string; alpha: number } | undefined;
	if (highlight) {
		const itemIcon = await OSRSCanvas.getItemImage({
			itemID: entry.id,
			iconPackId: iconPackId ?? undefined
		});
		const itemIsDark = averageOpaqueLuminance(itemIcon) < 0.45;
		if (itemIsDark) {
			canvas.ctx.fillStyle = 'rgba(243, 227, 181, 0.85)';
			fillRoundRect(canvas.ctx, plateX, plateY, plateW, plateH, plateR);
			canvas.ctx.strokeStyle = 'rgba(140, 105, 40, 0.9)';
			canvas.ctx.lineWidth = 1.5;
			strokeRoundRect(canvas.ctx, plateX, plateY, plateW, plateH, plateR);
			winnerOutline = { outlineColor: '#2a241c', alpha: 1 };
		} else {
			canvas.ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
			fillRoundRect(canvas.ctx, plateX, plateY, plateW, plateH, plateR);
			canvas.ctx.strokeStyle = 'rgba(243, 227, 181, 0.85)';
			canvas.ctx.lineWidth = 1.5;
			strokeRoundRect(canvas.ctx, plateX, plateY, plateW, plateH, plateR);
			winnerOutline = { outlineColor: '#F3E3B5', alpha: 1 };
		}
	} else {
		canvas.ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
		fillRoundRect(canvas.ctx, plateX, plateY, plateW, plateH, plateR);
	}

	await canvas.drawItemIDSprite({
		itemID: entry.id,
		x: itemX,
		y: itemY,
		iconPackId: iconPackId ?? undefined,
		outline: winnerOutline
	});

	canvas.drawText({
		text: truncateName(entry.name, 18),
		x: x + w / 2,
		y: y + h - 12,
		font: 'Compact',
		color: OSRSCanvas.COLORS.ORANGE,
		center: true
	});
}
