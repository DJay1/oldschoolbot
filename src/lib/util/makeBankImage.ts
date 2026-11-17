import type { Bank } from 'oldschooljs';

import { type BankFlag, bankImageTask } from '@/lib/canvas/bankImage.js';
import type { IconPackID } from '@/lib/canvas/iconPacks.js';
import type { Flags } from '@/lib/minions/types.js';

export interface MakeBankImageOptions {
	bank: Bank;
	content?: string;
	title?: string;
	background?: number;
	spoiler?: boolean;
	flags?: Record<string, string | number>;
	user?: MUser;
	previousCL?: Bank;
	showNewCL?: boolean;
	mahojiFlags?: BankFlag[];
	iconPackId?: IconPackID;
}

/**
 * What each bank image was drawn from, so a trip finish can redraw it with extra items
 * (for example event drops rolled after the task built its loot image).
 */
const bankImageSources = new WeakMap<SendableFile, MakeBankImageOptions>();

export function rememberBankImageSource(file: SendableFile, opts: MakeBankImageOptions) {
	bankImageSources.set(file, { ...opts, bank: opts.bank.clone() });
}

export function bankImageSource(file: SendableFile | undefined): MakeBankImageOptions | undefined {
	return file ? bankImageSources.get(file) : undefined;
}

export async function makeBankImage({
	bank,
	title,
	background,
	user,
	previousCL,
	spoiler,
	showNewCL = false,
	flags = {},
	mahojiFlags = [],
	iconPackId
}: MakeBankImageOptions): Promise<SendableFile> {
	const realFlags: Flags = { ...flags, background: background ?? 1, nocache: 1 };
	if (showNewCL || previousCL !== undefined) realFlags.showNewCL = 1;

	const { image } = await bankImageTask.generateBankImage({
		bank,
		title,
		showValue: true,
		flags: realFlags,
		user,
		collectionLog: previousCL,
		mahojiFlags,
		iconPackId
	});

	const file: SendableFile = {
		name: `${spoiler ? 'SPOILER_' : ''}bank.png`,
		buffer: image
	};
	rememberBankImageSource(file, {
		bank,
		title,
		background,
		user,
		previousCL,
		spoiler,
		showNewCL,
		flags,
		mahojiFlags,
		iconPackId
	});
	return file;
}
