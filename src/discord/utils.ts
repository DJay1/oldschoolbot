import { ApplicationCommandType, type RESTPostAPIApplicationGuildCommandsJSONBody, Routes } from '@oldschoolgg/discord';

import { convertCommandOptionToAPIOption } from '@/discord/index.js';
import { globalConfig, testingShortcutsEnabled } from '@/lib/constants.js';

export async function resolveBotSendableMessage(rawMessage: SendableMessage): Promise<BaseSendableMessage> {
	if (typeof rawMessage === 'string') {
		return { content: rawMessage };
	}
	if ('build' in rawMessage) {
		return resolveBotSendableMessage(await rawMessage.build());
	}
	return rawMessage;
}

export function mentionCommand(name: string, subCommand?: string, subSubCommand?: string) {
	if (process.env.TEST) return '';
	const command = globalClient.allCommands.find(i => i.name === name);
	if (!command) {
		throw new Error(`Command ${name} not found`);
	}
	if (subCommand && !command.options.some(i => i.name === subCommand)) {
		throw new Error(`Command ${name} does not have subcommand ${subCommand}`);
	}

	const apiCommand = globalClient.applicationCommands!.find(i => i.name === name);
	if (!apiCommand) {
		throw new Error(`API Command ${name} not found`);
	}

	if (subCommand) {
		return `</${name} ${subCommand}${subSubCommand ? ` ${subSubCommand}` : ''}:${apiCommand.id}>`;
	}

	return `</${name}:${apiCommand.id}>`;
}

type RegisteredCommandBody = RESTPostAPIApplicationGuildCommandsJSONBody & {
	description: string;
	dm_permission?: boolean;
	contexts?: number[];
};

function convertCommandToAPICommand(cmd: AnyCommand, allowDms: boolean): RegisteredCommandBody {
	const body: RegisteredCommandBody = {
		type: ApplicationCommandType.ChatInput,
		name: cmd.name,
		description: cmd.description,
		options: cmd.options.map(convertCommandOptionToAPIOption)
	};
	if (cmd.name === 'testpotato') {
		// Hidden from everyone except server administrators; the command itself only runs for the bot admin.
		(body as { default_member_permissions?: string }).default_member_permissions = '0';
	}
	if (!allowDms) return body;
	if (cmd.guildId) {
		body.dm_permission = false;
		body.contexts = [0];
		return body;
	}
	// Guild, bot DMs, and group DMs. Guild-only test registration does not set these.
	body.dm_permission = true;
	body.contexts = [0, 1, 2];
	return body;
}

export async function bulkUpdateCommands() {
	if (testingShortcutsEnabled()) {
		const body = globalClient.allCommands.map(cmd => convertCommandToAPICommand(cmd, false));
		return globalClient.rest.put(globalClient.apiCommandsRoute(), {
			body
		});
	}

	// Live bots register global commands so they can be used in DMs, and keep guild-only commands on the support server.
	const globalCommands = globalClient.allCommands
		.filter(i => !i.guildId)
		.map(cmd => convertCommandToAPICommand(cmd, true));
	const guildCommands = globalClient.allCommands
		.filter(i => Boolean(i.guildId))
		.map(cmd => convertCommandToAPICommand(cmd, true));

	return Promise.all([
		globalClient.rest.put(Routes.applicationCommands(globalClient.applicationId), { body: globalCommands }),
		globalClient.rest.put(
			Routes.applicationGuildCommands(globalClient.applicationId, globalConfig.supportServerID),
			{
				body: guildCommands
			}
		)
	]);
}
