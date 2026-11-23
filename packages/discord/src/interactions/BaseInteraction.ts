import { makeURLSearchParams, type REST } from '@discordjs/rest';
import type { IButtonInteraction, IChatInputCommandInteraction } from '@oldschoolgg/schemas';
import { isObject } from '@oldschoolgg/util';
import {
	type APIBaseMessageNoChannel,
	type APIChatInputApplicationCommandInteraction,
	type APIMessage,
	type APIMessageComponentInteraction,
	ComponentType,
	InteractionResponseType,
	MessageFlags,
	type RESTPostAPIInteractionCallbackWithResponseResult,
	Routes,
	TextInputStyle
} from 'discord-api-types/v10';

import { userIdsMentionedInContent } from '../client/allowedMentions.js';
import type { DiscordClient } from '../client/DiscordClient.js';
import { type APISendableMessage, type SendableMessage, sendableMsgToApiCreate } from '../client/types.js';

type EditMessageOptions = SendableMessage;

/** Shown in place of "thinking..." when the real reply had to be posted as a new message to ping someone. */
// Discord subtext ("-# "): small grey text. A lone emoji would render jumbo-sized and clutter the channel.
export const DEFERRED_PING_PLACEHOLDER = '-# ↓ See below';

/** True for a plain message object that asks to be ephemeral (strings and builders are never ephemeral). */
export function wantsEphemeral(options: SendableMessage): boolean {
	return typeof options === 'object' && options !== null && !('build' in options) && options.ephemeral === true;
}

export class BaseInteraction {
	public client: DiscordClient;
	public readonly id: string;
	private readonly token: string;
	private readonly applicationId: string;
	public readonly rawInteraction: APIMessageComponentInteraction | APIChatInputApplicationCommandInteraction;
	private _deferred = false;
	private _replied = false;
	private _ephemeral = false;
	private _notifyMessageId: string | null = null;
	private _pingedUserIds = new Set<string>();
	/** Reply messages ('@original' or follow-up ids) that currently show buttons. */
	private _componentMessageIds = new Set<string>();
	private readonly rest: REST;
	private _data: IChatInputCommandInteraction | IButtonInteraction;
	public userId: string;

	constructor({
		client,
		data,
		applicationId,
		rawInteraction
	}: {
		client: DiscordClient;
		data: IChatInputCommandInteraction | IButtonInteraction;
		applicationId: string;
		rawInteraction: APIMessageComponentInteraction | APIChatInputApplicationCommandInteraction;
	}) {
		this.id = data.id;
		this.token = data.token;
		this.applicationId = applicationId;
		this.rest = client.rest;
		this.client = client;
		this._data = data;
		this.userId = data.user_id;
		this.rawInteraction = rawInteraction;
	}

	get customId(): string | null {
		if (this._data.kind !== 'Button') throw new Error('Interaction is not a button interaction.');
		return this._data.custom_id;
	}

	get raw(): IChatInputCommandInteraction | IButtonInteraction {
		return this._data;
	}

	get deferred(): boolean {
		return this._deferred;
	}
	get replied(): boolean {
		return this._replied;
	}
	get ephemeral(): boolean {
		return this._ephemeral;
	}
	get channelId(): string {
		return this._data.channel_id;
	}
	get guildId(): string | null {
		return this._data.guild_id;
	}

	get createdTimestamp(): number {
		return this._data.created_timestamp;
	}

	get kind(): 'ChatInputCommand' | 'Button' {
		return this._data.kind;
	}

	get messageId(): string {
		if (this._data.kind !== 'Button') throw new Error('InteractionHasNoMessage');
		return this._data.message.id;
	}

	private async toBody(msg: SendableMessage, forEdit = false): Promise<APISendableMessage> {
		const result = await sendableMsgToApiCreate({ msg, forEdit });
		if (result.message.flags === MessageFlags.Ephemeral) {
			// Editing a public interaction reply with the ephemeral flag removes it
			// from the channel ("Original message was deleted") instead of converting it.
			if (forEdit && !this._ephemeral) {
				result.message.flags = undefined;
			} else {
				this._ephemeral = true;
			}
		}
		return result;
	}

	private async sendCallback(
		type: InteractionResponseType,
		options?: SendableMessage & { withResponse?: boolean }
	): Promise<RESTPostAPIInteractionCallbackWithResponseResult | null> {
		const query = makeURLSearchParams({
			with_response: options?.withResponse ?? false,
			thread_id: isObject(options) && 'threadId' in options ? options.threadId : undefined
		});
		const { files, message } = options
			? await this.toBody(options, type === InteractionResponseType.UpdateMessage)
			: { files: undefined, message: undefined };
		return this.rest.post(Routes.interactionCallback(this.id, this.token), {
			auth: false,
			body: { type, data: message },
			files: files ?? undefined,
			query
		}) as Promise<RESTPostAPIInteractionCallbackWithResponseResult | null>;
	}

	private async sendWebhookCreate(options: SendableMessage): Promise<APIMessage> {
		const { files, message } = await this.toBody(options);
		return this.rest.post(Routes.webhook(this.applicationId, this.token), {
			auth: false,
			body: message,
			files: files ?? undefined,
			query: makeURLSearchParams()
		}) as Promise<APIMessage>;
	}

	private async sendWebhookEdit(
		messageId: string,
		options: SendableMessage
	): Promise<RESTPostAPIInteractionCallbackWithResponseResult> {
		const { files, message } = await this.toBody(options, true);
		return this.rest.patch(Routes.webhookMessage(this.applicationId, this.token, messageId), {
			auth: false,
			body: message,
			files: files ?? undefined
		}) as Promise<RESTPostAPIInteractionCallbackWithResponseResult>;
	}

	async baseDeferReply(
		options: { ephemeral?: boolean; withResponse?: boolean; threadId?: string } = {}
	): Promise<ReturnType<typeof this.sendCallback> | undefined> {
		if (this._deferred) return;
		if (this.replied) throw new Error('baseDeferReply: Tried to defer an interaction that was already replied');
		const flags = options.ephemeral ? MessageFlags.Ephemeral : 0;
		const res: any = await this.rest.post(Routes.interactionCallback(this.id, this.token), {
			auth: false,
			body: { type: InteractionResponseType.DeferredChannelMessageWithSource, data: { flags } },
			query: makeURLSearchParams({ with_response: options.withResponse ?? false, thread_id: options.threadId })
		});
		this._deferred = true;
		this._ephemeral = Boolean(flags & MessageFlags.Ephemeral);
		return options.withResponse ? res : undefined;
	}

	/**
	 * Users this message will actually notify: listed in allowed_mentions AND mentioned in the content.
	 * Ephemeral messages never notify anyone.
	 */
	private notifiableUsers(message: APISendableMessage['message']): string[] {
		if (this._ephemeral || ((message.flags ?? 0) & MessageFlags.Ephemeral) !== 0) return [];
		const allowed = new Set(message.allowed_mentions?.users ?? []);
		return userIdsMentionedInContent(message.content).filter(id => allowed.has(id));
	}

	private rememberPingedUsers(ids: readonly string[]) {
		for (const id of ids) this._pingedUserIds.add(id);
	}

	/**
	 * Discord does not send mention notifications for edited messages. After a defer (or an earlier
	 * reply), any reply that needs to ping a user who has not been pinged yet is posted as a new
	 * follow-up message. Nothing is deleted. After a defer the "thinking..." placeholder is first
	 * resolved to a neutral marker (Discord would otherwise turn the follow-up into that placeholder,
	 * which is an edit and does not ping); if the follow-up then fails, the placeholder is edited to the
	 * full reply instead. On later pings the previous message only has its buttons removed. Users only count as
	 * pinged once a new (notifying) message mentioning them was sent; edits never mark anyone.
	 * Replies with no new pings edit the latest message as before.
	 */
	private trackComponents(messageId: string, hasComponents: boolean) {
		if (hasComponents) this._componentMessageIds.add(messageId);
		else this._componentMessageIds.delete(messageId);
	}

	/** Edit a reply message and remember whether it now shows buttons. */
	private async editTracked(messageId: string, options: SendableMessage, hasComponents: boolean) {
		const res = await this.sendWebhookEdit(messageId, options);
		this.trackComponents(messageId, hasComponents);
		return res;
	}

	/** Post a follow-up and remember whether it shows buttons. */
	private async createTracked(options: SendableMessage, hasComponents: boolean): Promise<APIMessage> {
		const created = await this.sendWebhookCreate(options);
		this.trackComponents(created.id, hasComponents);
		return created;
	}

	/**
	 * Only the latest reply message may keep buttons. Strip them from every other reply message this
	 * interaction posted (placeholder and older follow-ups), so no stale Confirm button stays visible
	 * after a timeout, cancel, finish or a fallback.
	 */
	private async clearOtherComponents(keepMessageId: string) {
		for (const id of [...this._componentMessageIds]) {
			if (id === keepMessageId) continue;
			try {
				await this.sendWebhookEdit(id, { components: [] });
			} catch {}
			this._componentMessageIds.delete(id);
		}
	}

	async baseReply(
		options: SendableMessage
	): Promise<RESTPostAPIInteractionCallbackWithResponseResult | APIBaseMessageNoChannel | APIMessage | null> {
		// Commands are acknowledged (deferred, public) as soon as they arrive. An edit can't turn that public
		// placeholder private, so the first ephemeral reply removes the placeholder and is sent as an ephemeral
		// follow-up instead. Later replies edit that follow-up.
		if (this._deferred && !this._replied && !this._ephemeral && wantsEphemeral(options)) {
			this._replied = true;
			try {
				await this.rest.delete(Routes.webhookMessage(this.applicationId, this.token, '@original'), {
					auth: false
				});
			} catch {}
			const prepared = await this.toBody(options);
			const created = await this.createTracked(options, (prepared.message.components?.length ?? 0) > 0);
			this._notifyMessageId = created.id;
			return created;
		}
		if (this._deferred || this._replied) {
			const prepared = await this.toBody(options);
			const notifiable = this.notifiableUsers(prepared.message);
			const newPings = notifiable.filter(id => !this._pingedUserIds.has(id));
			// Edits without components clear them (resolveComponents sends []), so this is accurate for edits too.
			const hasComponents = (prepared.message.components?.length ?? 0) > 0;

			if (newPings.length > 0) {
				if (!this._replied) {
					// Discord turns the FIRST webhook message after a defer into the deferred reply itself
					// (an edit, so no ping). Resolve the "thinking..." placeholder first so the follow-up
					// below is a genuinely new message that notifies.
					await this.editTracked('@original', { content: DEFERRED_PING_PLACEHOLDER, components: [] }, false);
					this._replied = true;
				}
				const previousId = this._notifyMessageId ?? '@original';
				let created: APIMessage;
				try {
					created = await this.createTracked(options, hasComponents);
				} catch (err) {
					// Never leave the command without its reply: fall back to editing the latest message
					// (no ping), and make sure that is the only message with buttons.
					try {
						const res = await this.editTracked(previousId, options, hasComponents);
						await this.clearOtherComponents(previousId);
						return res;
					} catch {
						throw err;
					}
				}
				this.rememberPingedUsers(notifiable);
				this._notifyMessageId = created.id;
				await this.clearOtherComponents(created.id);
				return created;
			}

			this._replied = true;
			const targetId = this._notifyMessageId ?? '@original';
			const res = await this.editTracked(targetId, options, hasComponents);
			await this.clearOtherComponents(targetId);
			return res;
		}
		this._replied = true;
		const res = await this.sendCallback(InteractionResponseType.ChannelMessageWithSource, options);
		const prepared = await this.toBody(options);
		this.trackComponents('@original', (prepared.message.components?.length ?? 0) > 0);
		this.rememberPingedUsers(this.notifiableUsers(prepared.message));
		return res;
	}

	async baseDeferUpdate(
		options: { withResponse?: boolean } = {}
	): Promise<ReturnType<typeof this.sendCallback> | undefined> {
		if (this._deferred || this._replied) throw new Error('baseDeferUpdate: InteractionAlreadyReplied');
		const res = await this.sendCallback(InteractionResponseType.DeferredMessageUpdate);
		this._deferred = true;
		return options.withResponse ? res : undefined;
	}

	async update(
		options: SendableMessage & { withResponse?: boolean }
	): Promise<ReturnType<typeof this.sendCallback> | undefined> {
		if (this._deferred || this._replied) throw new Error('update: InteractionAlreadyReplied');
		const res = await this.sendCallback(InteractionResponseType.UpdateMessage, options);
		this._replied = true;
		return options.withResponse ? res : undefined;
	}

	async followUp(options: SendableMessage): Promise<APIMessage> {
		if (!this._deferred && !this._replied) throw new Error('followUp: InteractionNotReplied');
		return this.sendWebhookCreate(options);
	}

	async fetchReply(message: string | '@original' = '@original'): Promise<APIMessage> {
		return this.rest.get(Routes.webhookMessage(this.applicationId, this.token, message), {
			auth: false
		}) as Promise<APIMessage>;
	}

	async baseEditReply(options: EditMessageOptions): Promise<RESTPostAPIInteractionCallbackWithResponseResult> {
		if (!this._deferred && !this._replied) throw new Error('InteractionNotReplied');
		return this.sendWebhookEdit('@original', options);
	}

	async deleteReply(message: string | '@original' = '@original'): Promise<void> {
		if (!this._deferred && !this._replied) throw new Error('InteractionNotReplied');
		await this.rest.delete(Routes.webhookMessage(this.applicationId, this.token, message), { auth: false });
	}

	public async silentButtonAck(): Promise<void> {
		await this.rest.post(Routes.interactionCallback(this.id, this.token), {
			body: {
				type: InteractionResponseType.DeferredMessageUpdate
			}
		});
	}

	public async deferredMessageUpdate(): Promise<void> {
		await this.rest.post(Routes.interactionCallback(this.id, this.token), {
			body: {
				type: InteractionResponseType.DeferredMessageUpdate
			}
		});
	}

	async showModal(modal: {
		customId: string;
		title: string;
		textInput: {
			customId: string;
			label: string;
			placeholder?: string;
			minLength?: number;
			maxLength?: number;
		};
	}): Promise<void> {
		if (this._deferred || this._replied) throw new Error('showModal: InteractionAlreadyReplied');
		await this.rest.post(Routes.interactionCallback(this.id, this.token), {
			auth: false,
			body: {
				type: InteractionResponseType.Modal,
				data: {
					custom_id: modal.customId,
					title: modal.title.slice(0, 45),
					components: [
						{
							type: ComponentType.ActionRow,
							components: [
								{
									type: ComponentType.TextInput,
									custom_id: modal.textInput.customId,
									style: TextInputStyle.Short,
									label: modal.textInput.label.slice(0, 45),
									required: true,
									placeholder: modal.textInput.placeholder?.slice(0, 100),
									min_length: modal.textInput.minLength,
									max_length: modal.textInput.maxLength
								}
							]
						}
					]
				}
			}
		});
		this._replied = true;
	}
}
