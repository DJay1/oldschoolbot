import type { ButtonBuilder, EmbedBuilder } from '@oldschoolgg/discord';
import type { Bank } from 'oldschooljs';

import chatHeadImage, { type HeadKey } from '@/lib/canvas/chatHeadImage.js';
import { chestLootImageSource, type DrawChestLootImageOptions, drawChestLootImage } from '@/lib/canvas/chestImage.js';
import { bankImageSource, type MakeBankImageOptions, makeBankImage } from '@/lib/util/makeBankImage.js';

export class MessageBuilderClass {
	private _message: BaseSendableMessage;
	private chatHeadImagePromise?: Promise<SendableFile>;
	private bankImagePromise?: Promise<SendableFile>;
	private chestLootImagePromise?: Promise<SendableFile>;
	private chestLootImageOptions?: DrawChestLootImageOptions;
	private _built = false;

	constructor(startingMessage: BaseSendableMessage = {}) {
		this._message = startingMessage;
		if (!this._message.components) this._message.components = [];
		if (!this._message.content) this._message.content = '';
	}

	get message() {
		return this._message;
	}

	setContent(content: string): this {
		this._message.content = content;
		return this;
	}

	addContent(content: string): this {
		this._message.content += content;
		return this;
	}

	addEmbed(embed: EmbedBuilder): this {
		if (!this._message.embeds) this._message.embeds = [];
		this._message.embeds.push(embed);
		return this;
	}

	addFile(file: SendableFile): this {
		if (!this._message.files) this._message.files = [];
		this._message.files.push(file);
		return this;
	}

	addChatHeadImage(head: HeadKey, content: string): this {
		this.chatHeadImagePromise = chatHeadImage({ head, content });
		return this;
	}

	addBankImage(opts: MakeBankImageOptions): this {
		this.bankImagePromise = makeBankImage(opts);
		return this;
	}

	/**
	 * Redraws this message's bank loot image with `extras` added, for items rolled after the
	 * image was made. Display only: it never touches anyone's bank. Returns false when the
	 * message has no bank image to redraw.
	 */
	async addItemsToBankImage(
		extras: Bank,
		render: (opts: MakeBankImageOptions) => Promise<SendableFile> = makeBankImage
	): Promise<boolean> {
		if (extras.length === 0) return false;
		if (this.bankImagePromise) {
			const file = await this.bankImagePromise;
			const source = bankImageSource(file);
			if (!source) return false;
			this.bankImagePromise = render({ ...source, bank: source.bank.clone().add(extras) });
			return true;
		}
		const files = this._message.files ?? [];
		for (let i = files.length - 1; i >= 0; i--) {
			const source = bankImageSource(files[i]);
			if (!source) continue;
			files[i] = await render({ ...source, bank: source.bank.clone().add(extras) });
			return true;
		}
		return false;
	}

	/**
	 * Redraws this message's chest loot image with extras added to the given user's
	 * panel (or the only panel). Display only: it never touches anyone's bank. Returns
	 * false when the message has no chest image to redraw.
	 */
	async addItemsToChestLootImageForUsers(
		extrasByUser: { userId: string; items: Bank }[],
		render: (opts: DrawChestLootImageOptions) => Promise<SendableFile> = drawChestLootImage
	): Promise<boolean> {
		const added = new Map<string, Bank>();
		for (const { userId, items } of extrasByUser) {
			if (items.length === 0) continue;
			const current = added.get(userId);
			added.set(userId, current ? current.add(items) : items.clone());
		}
		if (added.size === 0) return false;

		const withExtras = (opts: DrawChestLootImageOptions): DrawChestLootImageOptions | null => {
			let changed = false;
			const entries = opts.entries.map(entry => {
				const extra = added.get(entry.user.id);
				if (!extra || extra.length === 0) return entry;
				changed = true;
				return { ...entry, loot: entry.loot.clone().add(extra) };
			});
			if (!changed) return null;
			return { type: opts.type, entries };
		};

		if (this.chestLootImageOptions) {
			const next = withExtras(this.chestLootImageOptions);
			if (!next) return false;
			this.chestLootImageOptions = next;
			this.chestLootImagePromise = render(next);
			return true;
		}

		const files = this._message.files ?? [];
		for (let i = files.length - 1; i >= 0; i--) {
			const source = chestLootImageSource(files[i]);
			if (!source) continue;
			const next = withExtras(source);
			if (!next) return false;
			files[i] = await render(next);
			return true;
		}
		return false;
	}

	async addItemsToChestLootImage(
		extras: Bank,
		userId: string,
		render: (opts: DrawChestLootImageOptions) => Promise<SendableFile> = drawChestLootImage
	): Promise<boolean> {
		return this.addItemsToChestLootImageForUsers([{ userId, items: extras }], render);
	}

	addChestLootImage(opts: DrawChestLootImageOptions): this {
		this.chestLootImageOptions = {
			type: opts.type,
			entries: opts.entries.map(entry => ({ ...entry, loot: entry.loot.clone() }))
		};
		this.chestLootImagePromise = drawChestLootImage(this.chestLootImageOptions);
		return this;
	}

	addComponents(components?: ButtonBuilder[]): this {
		if (!components) return this;
		if (!this._message.components) this._message.components = [];
		// @ts-expect-error
		this._message.components.push(...components);
		return this;
	}

	removeComponents(): this {
		this._message.components = [];
		return this;
	}

	addAllowedUserMentions(userIDs: string[]): this {
		if (!this._message.allowedMentions) {
			this._message.allowedMentions = { users: [], roles: [], parse: [] };
		}
		if (!this._message.allowedMentions.users) {
			this._message.allowedMentions.users = [];
		}
		this._message.allowedMentions.users.push(
			...userIDs.filter(id => !this._message.allowedMentions!.users!.includes(id))
		);
		return this;
	}

	async merge(message: MessageBuilderClass | string) {
		if (typeof message === 'string') {
			this.addContent(message);
			return this;
		}
		if (message.chatHeadImagePromise) {
			this.addFile(await message.chatHeadImagePromise);
		}
		if (message.chestLootImagePromise) {
			this.addFile(await message.chestLootImagePromise);
		}
		if (message.bankImagePromise) {
			this.addFile(await message.bankImagePromise);
		}
		if (message.message.components) {
			this.addComponents(message.message.components as ButtonBuilder[]);
		}
		return this;
	}

	async build(): Promise<SendableMessage> {
		// sendableMsgToApiCreate / interaction replies may call build() more than
		// once on the same instance. Adding generated images only on the first
		// call keeps a single attachment per image.
		if (this._built) {
			return this._message;
		}
		this._built = true;
		try {
			if (this.chatHeadImagePromise) {
				const chatHeadImage = await this.chatHeadImagePromise;
				this.addFile(chatHeadImage);
			}
			if (this.bankImagePromise) {
				const bankImage = await this.bankImagePromise;
				this.addFile(bankImage);
			}
			if (this.chestLootImagePromise) {
				this.addFile(await this.chestLootImagePromise);
			}
		} catch (error) {
			this._built = false;
			throw error;
		}
		return this._message;
	}
}

declare global {
	var MessageBuilder: typeof MessageBuilderClass;
}

global.MessageBuilder = MessageBuilderClass;
