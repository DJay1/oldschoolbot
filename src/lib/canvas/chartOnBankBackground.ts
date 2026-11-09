import { bankImageTask } from '@/lib/canvas/bankImage.js';
import { loadImage } from '@/lib/canvas/canvasUtil.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

const PADDING = 12;
const GREY_TOLERANCE = 40;

function whiteToTransparentWithLightText(image: Awaited<ReturnType<typeof loadImage>>) {
	const canvas = new OSRSCanvas({ width: image.width, height: image.height });
	canvas.ctx.drawImage(image, 0, 0);
	const imageData = canvas.ctx.getImageData(0, 0, image.width, image.height);
	const pixels = imageData.data;
	for (let i = 0; i < pixels.length; i += 4) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		const lowest = Math.min(r, g, b);
		const alpha = (255 - lowest) / 255;
		if (alpha <= 0) {
			pixels[i + 3] = 0;
			continue;
		}
		const isGrey = Math.max(r, g, b) - lowest < GREY_TOLERANCE;
		pixels[i] = isGrey ? 255 : Math.round(255 - (255 - r) / alpha);
		pixels[i + 1] = isGrey ? 255 : Math.round(255 - (255 - g) / alpha);
		pixels[i + 2] = isGrey ? 255 : Math.round(255 - (255 - b) / alpha);
		pixels[i + 3] = Math.round((pixels[i + 3] * alpha * 255) / 255);
	}
	canvas.ctx.putImageData(imageData, 0, 0);
	return canvas.getCanvas();
}

export async function drawChartOnBankBackground({
	chart,
	bankBackgroundId
}: {
	chart: Buffer;
	bankBackgroundId?: number | null;
}): Promise<Buffer> {
	if (chart.length === 0) return chart;

	let chartImage: Awaited<ReturnType<typeof loadImage>>;
	try {
		chartImage = await loadImage(chart);
	} catch {
		return chart;
	}

	if (!bankImageTask.ready) {
		await bankImageTask.init();
		bankImageTask.ready = true;
	}
	const { sprite, backgroundImage } = bankImageTask.getBgAndSprite({ bankBackgroundId: bankBackgroundId ?? 1 });

	const width = chartImage.width + PADDING * 2;
	const height = chartImage.height + PADDING * 2;
	const canvas = new OSRSCanvas({ width, height, sprite });
	const { ctx } = canvas;

	canvas.drawBackgroundPattern(sprite);
	if (backgroundImage) {
		const scale = Math.max(width / backgroundImage.width, height / backgroundImage.height);
		const drawWidth = backgroundImage.width * scale;
		const drawHeight = backgroundImage.height * scale;
		ctx.save();
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(backgroundImage, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
		ctx.restore();
	}

	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
	ctx.fillRect(PADDING / 2, PADDING / 2, width - PADDING, height - PADDING);
	ctx.restore();

	ctx.save();
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(whiteToTransparentWithLightText(chartImage), PADDING, PADDING, chartImage.width, chartImage.height);
	ctx.restore();

	canvas.drawBorder(sprite, false);

	return canvas.toBuffer();
}
