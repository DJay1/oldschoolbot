import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Image } from 'skia-canvas';
import { loadImage } from 'skia-canvas';

import { bankImageTask } from '@/lib/canvas/bankImage.js';
import type { IconPackID } from '@/lib/canvas/iconPacks.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

const WIDTH = 960;
const HEIGHT = 720;
const FRAME = 34;

const TIER_COLORS: Record<string, string> = {
	pup: '#C4A574',
	goodboy: '#8B5A2B',
	topdog: '#4F7FE8',
	alpha: '#C84E9A',
	packleader: '#C45C26',
	biggestofdogs: '#D4A017'
};

const TIER_FALLBACK_BG: Record<string, number> = {
	pup: 6,
	goodboy: 1019,
	packleader: 1027
};

export interface PatronProfileCardData {
	username: string;
	tierName: string | null;
	tierKey: string | null;
	title: string | null;
	flair: string | null;
	months: number;
	/** Emoji file stems shown next to the name in /minion info, in the same order. */
	badgeFiles?: string[];
	/** Emoji file stems for every earned loyalty badge, e.g. patron_loyalty_1. */
	loyaltyBadgeFiles?: string[];
	totalLevel: number;
	clPercent: number;
	favoritePetId: number | null;
	favoritePetName: string | null;
	rarestDropId: number | null;
	rarestDropName: string | null;
	bankBackgroundId?: number | null;
	iconPackId?: IconPackID | null;
}

export function profileCardBackgroundId(bankBackgroundId: number | null | undefined, tierKey: string | null): number {
	const id = Number(bankBackgroundId ?? 0);
	if (id && id !== 1) return id;
	if (tierKey && TIER_FALLBACK_BG[tierKey]) return TIER_FALLBACK_BG[tierKey];
	return id || 1;
}

export function profileCardAccent(tierKey: string | null): string {
	return (tierKey && TIER_COLORS[tierKey]) || '#C9A44A';
}

function integerScale(srcW: number, srcH: number, maxW: number, maxH: number): number {
	return Math.max(1, Math.floor(Math.min(maxW / srcW, maxH / srcH)));
}

function fitSize(srcW: number, srcH: number, maxW: number, maxH: number) {
	const scale = Math.min(maxW / srcW, maxH / srcH);
	return { w: Math.max(1, Math.round(srcW * scale)), h: Math.max(1, Math.round(srcH * scale)) };
}

function drawOutlinedText(
	ctx: OSRSCanvas['ctx'],
	text: string,
	x: number,
	y: number,
	font: string,
	color: string,
	opts?: { center?: boolean; shadow?: number }
) {
	ctx.font = font;
	let drawX = Math.floor(x);
	const drawY = Math.floor(y);
	if (opts?.center) {
		drawX -= Math.floor(ctx.measureText(text).width / 2);
	}
	const shadow = opts?.shadow ?? 2;
	const outlineText = (ctx as OSRSCanvas['ctx'] & { outlineText?: OSRSCanvas['ctx']['outlineText'] }).outlineText;
	ctx.fillStyle = '#000000';
	if (typeof outlineText === 'function') {
		ctx.fill(outlineText.call(ctx, text).offset(drawX + shadow, drawY + shadow));
		ctx.fillStyle = color;
		ctx.fill(outlineText.call(ctx, text).offset(drawX, drawY));
		return;
	}
	ctx.fillText(text, drawX + shadow, drawY + shadow);
	ctx.fillStyle = color;
	ctx.fillText(text, drawX, drawY);
}

function ring(ctx: OSRSCanvas['ctx'], x: number, y: number, w: number, h: number, thickness: number, color: string) {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, thickness);
	ctx.fillRect(x, y + h - thickness, w, thickness);
	ctx.fillRect(x, y, thickness, h);
	ctx.fillRect(x + w - thickness, y, thickness, h);
}

function drawWoodFrame(ctx: OSRSCanvas['ctx'], width: number, height: number, accent: string) {
	const wood = '#4A3318';
	const woodDark = '#24160A';
	const woodMid = '#6B4A24';
	const woodLight = '#8B6230';
	const gold = '#D4B45A';
	const goldDark = '#8A6A1C';
	const goldLight = '#F3E09A';
	const t = FRAME;

	ring(ctx, 0, 0, width, height, t, wood);
	ring(ctx, 0, 0, width, height, 5, woodDark);
	ring(ctx, 3, 3, width - 6, height - 6, 3, woodLight);
	ring(ctx, 7, 7, width - 14, height - 14, 4, woodMid);
	ring(ctx, t - 10, t - 10, width - 2 * (t - 10), height - 2 * (t - 10), 5, goldDark);
	ring(ctx, t - 9, t - 9, width - 2 * (t - 9), height - 2 * (t - 9), 2, goldLight);
	ring(ctx, t - 7, t - 7, width - 2 * (t - 7), height - 2 * (t - 7), 2, gold);
	ring(ctx, t - 4, t - 4, width - 2 * (t - 4), height - 2 * (t - 4), 2, accent);
	ring(ctx, t - 2, t - 2, width - 2 * (t - 2), height - 2 * (t - 2), 2, woodDark);

	const corners: Array<[number, number, number, number]> = [
		[0, 0, 1, 1],
		[width, 0, -1, 1],
		[0, height, 1, -1],
		[width, height, -1, -1]
	];
	for (const [cx, cy, sx, sy] of corners) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.scale(sx, sy);
		ctx.fillStyle = goldDark;
		ctx.fillRect(6, 6, 36, 8);
		ctx.fillRect(6, 6, 8, 36);
		ctx.fillStyle = gold;
		ctx.fillRect(8, 8, 30, 4);
		ctx.fillRect(8, 8, 4, 30);
		ctx.fillStyle = goldLight;
		ctx.fillRect(10, 10, 16, 2);
		ctx.fillRect(10, 10, 2, 16);
		ctx.fillStyle = goldLight;
		ctx.fillRect(14, 14, 8, 8);
		ctx.fillStyle = gold;
		ctx.fillRect(16, 16, 4, 4);
		ctx.restore();
	}
}

function drawInsetPanel(ctx: OSRSCanvas['ctx'], x: number, y: number, w: number, h: number, accent: string) {
	ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
	ctx.fillRect(x, y, w, h);
	ctx.strokeStyle = '#1A1208';
	ctx.lineWidth = 3;
	ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
	ctx.strokeStyle = accent;
	ctx.lineWidth = 2;
	ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
	ctx.strokeStyle = '#D4B45A';
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
}

async function loadEmojiPng(name: string): Promise<Image | null> {
	const filePath = path.resolve(`assets/emojis/${name}.png`);
	if (!existsSync(filePath)) return null;
	return loadImage(filePath);
}

export async function renderPatronProfileCard(data: PatronProfileCardData): Promise<Buffer> {
	if (!bankImageTask.ready) {
		await bankImageTask.init();
		bankImageTask.ready = true;
	}

	const bgId = profileCardBackgroundId(data.bankBackgroundId, data.tierKey);
	const { sprite, backgroundImage } = bankImageTask.getBgAndSprite({ bankBackgroundId: bgId });
	const canvas = new OSRSCanvas({
		width: WIDTH,
		height: HEIGHT,
		sprite,
		iconPackId: data.iconPackId ?? null
	});
	const { ctx } = canvas;
	ctx.imageSmoothingEnabled = false;

	if (sprite) {
		canvas.drawBackgroundPattern(sprite);
	} else {
		ctx.fillStyle = '#16120E';
		ctx.fillRect(0, 0, WIDTH, HEIGHT);
	}

	const innerX = FRAME;
	const innerY = FRAME;
	const innerW = WIDTH - FRAME * 2;
	const innerH = HEIGHT - FRAME * 2;
	if (backgroundImage) {
		const scale = Math.max(innerW / backgroundImage.width, innerH / backgroundImage.height);
		const drawWidth = backgroundImage.width * scale;
		const drawHeight = backgroundImage.height * scale;
		ctx.save();
		ctx.beginPath();
		ctx.rect(innerX, innerY, innerW, innerH);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(
			backgroundImage,
			innerX + (innerW - drawWidth) / 2,
			innerY + (innerH - drawHeight) / 2,
			drawWidth,
			drawHeight
		);
		ctx.restore();
	}
	ctx.fillStyle = 'rgba(0, 0, 0, 0.64)';
	ctx.fillRect(innerX, innerY, innerW, innerH);

	const accent = profileCardAccent(data.tierKey);
	drawWoodFrame(ctx, WIDTH, HEIGHT, accent);

	const contentX = FRAME + 28;
	const contentY = FRAME + 26;
	const headerRight = WIDTH - FRAME - 28;

	const panelW = 248;
	const panelH = 260;
	const panelX = contentX;
	const panelY = contentY;
	drawInsetPanel(ctx, panelX, panelY, panelW, panelH, accent);

	if (data.favoritePetId) {
		const icon = await OSRSCanvas.getItemImage({
			itemID: data.favoritePetId,
			iconPackId: data.iconPackId ?? undefined
		});
		const pad = 18;
		const scale = integerScale(icon.width, icon.height, panelW - pad * 2, panelH - pad * 2);
		const dw = icon.width * scale;
		const dh = icon.height * scale;
		const dx = Math.floor(panelX + (panelW - dw) / 2);
		const dy = Math.floor(panelY + (panelH - dh) / 2);
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(icon, 0, 0, icon.width, icon.height, dx, dy, dw, dh);
		ctx.restore();
	} else {
		drawOutlinedText(
			ctx,
			'Favorite pet: none',
			panelX + panelW / 2,
			panelY + Math.floor(panelH / 2) + 6,
			'22px OSRSFontCompact',
			'#9A8B78',
			{ center: true }
		);
	}

	const headerX = panelX + panelW + 28;
	const headerMaxW = headerRight - headerX;
	const name = data.username || 'Adventurer';
	let nameSize = 52;
	ctx.font = `${nameSize}px RuneScape Bold 12`;
	while (nameSize > 28 && ctx.measureText(name).width > headerMaxW) {
		nameSize -= 2;
		ctx.font = `${nameSize}px RuneScape Bold 12`;
	}
	drawOutlinedText(ctx, name, headerX, panelY + 62, `${nameSize}px RuneScape Bold 12`, '#E6C34A', { shadow: 3 });

	let cursorY = panelY + 112;
	if (data.title) {
		let titleSize = 30;
		ctx.font = `${titleSize}px RuneScape Bold 12`;
		while (titleSize > 18 && ctx.measureText(data.title).width > headerMaxW) {
			titleSize -= 2;
			ctx.font = `${titleSize}px RuneScape Bold 12`;
		}
		drawOutlinedText(ctx, data.title, headerX, cursorY, `${titleSize}px RuneScape Bold 12`, '#F5F0DC', {
			shadow: 2
		});
		cursorY += 38;
	}
	if (data.flair) {
		drawOutlinedText(ctx, data.flair, headerX, cursorY, '20px OSRSFontCompact', '#E8C99A');
		cursorY += 32;
	}

	const badges: Image[] = [];
	for (const file of [...(data.badgeFiles ?? []), ...(data.loyaltyBadgeFiles ?? [])]) {
		const icon = await loadEmojiPng(file);
		if (icon) badges.push(icon);
	}
	const badgeY = cursorY;
	const badgeGap = 8;
	const badgeMax = 56;
	const badgeAvail = Math.max(1, headerRight - headerX);
	const count = badges.length;
	const target = count === 0 ? badgeMax : Math.floor((badgeAvail - badgeGap * Math.max(0, count - 1)) / count);
	const badgeSize = Math.max(1, Math.min(badgeMax, target));
	let badgeX = headerX;
	let badgeRowH = 0;
	for (const badge of badges) {
		const { w: dw, h: dh } = fitSize(badge.width, badge.height, badgeSize, badgeSize);
		ctx.save();
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(badge, badgeX, badgeY, dw, dh);
		ctx.restore();
		badgeX += dw + badgeGap;
		badgeRowH = Math.max(badgeRowH, dh);
	}

	const statsY = Math.max(panelY + panelH + 40, badgeY + badgeRowH + 24);
	const clRounded = Math.round(data.clPercent * 10) / 10;
	const clText = Number.isInteger(clRounded) ? `${clRounded}%` : `${clRounded.toFixed(1)}%`;
	const rows: Array<[string, string, string]> = [
		['Tier', data.tierName ?? 'Not currently a patron', data.tierName ? accent : '#F5F0DC'],
		['Favorite pet', data.favoritePetName ?? 'none', '#FFFFFF'],
		['Rarest drop', data.rarestDropName ?? 'none yet', '#FFFFFF'],
		['Total level', String(data.totalLevel), '#FFFFFF'],
		['CL', clText, '#FFFFFF']
	];
	let sy = statsY;
	for (const [label, value, color] of rows) {
		drawOutlinedText(ctx, `${label}: ${value}`, contentX + 8, sy, '24px OSRSFontCompact', color, { shadow: 2 });
		sy += 38;
	}

	const footerY = HEIGHT - FRAME - 26;
	const monthsY = footerY - 38;
	const months = Math.max(0, data.months);
	const monthsText = months <= 0 ? 'Patron' : months === 1 ? 'Patron for 1 month' : `Patron for ${months} months`;
	drawOutlinedText(ctx, monthsText, WIDTH / 2, monthsY, '24px OSRSFontCompact', '#F5F0DC', {
		center: true,
		shadow: 2
	});

	drawOutlinedText(ctx, 'Bark School Corgo', WIDTH / 2, footerY, '16px OSRSFontCompact', '#C4B089', {
		center: true
	});

	void data.rarestDropId;
	return canvas.toBuffer();
}
