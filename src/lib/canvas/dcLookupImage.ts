import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

export interface DcLookupLine {
	text: string;
	color?: string;
	bullet?: boolean;
}

export interface DcLookupSection {
	title: string;
	titleColor?: string;
	lines: DcLookupLine[];
}

export interface DcLookupImageData {
	itemID: number;
	itemName: string;
	summary: DcLookupLine[];
	sections: DcLookupSection[];
}

const WIDTH = 488;
const PADDING = 16;
const TITLE_Y = 21;
const LINE_HEIGHT = 16;
const SECTION_GAP = 10;
const ICON_BOX = 72;
const BULLET_INDENT = 12;

function wrapText(canvas: OSRSCanvas, text: string, maxWidth: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (current && canvas.measureTextWidth(candidate) > maxWidth) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) lines.push(current);
	return lines;
}

export async function renderDcLookupImage(data: DcLookupImageData): Promise<Buffer> {
	if (!bankImageTask.ready) {
		await bankImageTask.init();
		bankImageTask.ready = true;
	}
	const { sprite } = bankImageTask.getBgAndSprite({ bankBackgroundId: 1 });
	const measure = new OSRSCanvas({ width: WIDTH, height: 10 });

	const summaryX = PADDING + ICON_BOX + 12;
	const summaryWidth = WIDTH - summaryX - PADDING;
	const summaryLines = data.summary.flatMap(line =>
		wrapText(measure, line.text, summaryWidth).map(text => ({ ...line, text }))
	);

	const contentWidth = WIDTH - PADDING * 2;
	const sections = data.sections.map(section => ({
		...section,
		lines: section.lines.flatMap(line => {
			const indent = line.bullet ? BULLET_INDENT : 0;
			return wrapText(measure, line.text, contentWidth - indent).map((text, index) => ({
				...line,
				text,
				bullet: line.bullet && index === 0,
				indent
			}));
		})
	}));

	const headerTop = TITLE_Y + 12;
	const headerHeight = Math.max(ICON_BOX, summaryLines.length * LINE_HEIGHT + 8);
	let height = headerTop + headerHeight + SECTION_GAP;
	for (const section of sections) height += LINE_HEIGHT + 4 + section.lines.length * LINE_HEIGHT + SECTION_GAP;
	height += PADDING - SECTION_GAP;

	const canvas = new OSRSCanvas({ width: WIDTH, height, sprite });
	const ctx = canvas.ctx;
	canvas.drawBackgroundPattern(sprite);
	canvas.drawBorder(sprite, true);
	canvas.drawTitleText({ text: data.itemName, x: Math.floor(WIDTH / 2), y: TITLE_Y, center: true });

	canvas.drawSquare(PADDING, headerTop, ICON_BOX, ICON_BOX, 'rgba(0, 0, 0, 0.35)');
	canvas.drawHollowSquare(PADDING, headerTop, ICON_BOX, ICON_BOX, OSRSCanvas.COLORS.LIGHT_CHOCOLATE);
	try {
		const icon = await OSRSCanvas.getItemImage({ itemID: data.itemID });
		const scale = Math.min(2, Math.floor((ICON_BOX - 8) / Math.max(icon.width, icon.height)) || 1);
		const iconWidth = icon.width * scale;
		const iconHeight = icon.height * scale;
		ctx.drawImage(
			icon,
			Math.floor(PADDING + (ICON_BOX - iconWidth) / 2),
			Math.floor(headerTop + (ICON_BOX - iconHeight) / 2),
			iconWidth,
			iconHeight
		);
	} catch {}

	let y = headerTop + LINE_HEIGHT;
	for (const line of summaryLines) {
		canvas.drawText({ text: line.text, x: summaryX, y, color: line.color ?? OSRSCanvas.COLORS.WHITE });
		y += LINE_HEIGHT;
	}

	y = headerTop + headerHeight + SECTION_GAP;
	for (const section of sections) {
		y += LINE_HEIGHT;
		canvas.drawText({
			text: section.title,
			x: PADDING,
			y,
			font: 'Bold',
			color: section.titleColor ?? OSRSCanvas.COLORS.ORANGE
		});
		y += 4;
		for (const line of section.lines) {
			y += LINE_HEIGHT;
			const color = line.color ?? OSRSCanvas.COLORS.WHITE;
			if (line.bullet) canvas.drawText({ text: '-', x: PADDING + 2, y, color });
			canvas.drawText({ text: line.text, x: PADDING + line.indent, y, color });
		}
		y += SECTION_GAP;
	}

	return canvas.toScaledOutput(2);
}
