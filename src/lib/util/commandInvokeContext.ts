import { AsyncLocalStorage } from 'node:async_hooks';

export type CommandInvokeStore = {
	interaction: OSInteraction;
	isContinue: boolean;
};

const commandInvokeContext = new AsyncLocalStorage<CommandInvokeStore>();

export function runInCommandInvokeContext<T>(store: CommandInvokeStore, fn: () => T): T {
	return commandInvokeContext.run(store, fn);
}

export function getCommandInvokeContext(): CommandInvokeStore | undefined {
	return commandInvokeContext.getStore();
}

export function isInteractiveSlashCommandStart(): boolean {
	const ctx = commandInvokeContext.getStore();
	if (!ctx) return false;
	if (ctx.isContinue) return false;
	if (typeof ctx.interaction.isChatInput !== 'function' || !ctx.interaction.isChatInput()) return false;
	return true;
}
