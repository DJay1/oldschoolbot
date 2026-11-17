import { cryptoRng } from 'node-rng/crypto';

import { rawCommandHandlerInner } from '@/discord/commandHandler.js';

export interface RunCommandArgs {
	commandName: string;
	args: CommandOptions;
	user: MUser;
	isContinue?: boolean;
	interaction: OSInteraction;
	continueDeltaMillis: number | null;
	ignoreUserIsBusy?: true;
}

/** Defers a real button interaction that hasn't been answered yet. Fake/internal interactions are left alone. */
export async function deferButtonBeforeCommand(interaction: RunCommandArgs['interaction']) {
	const itx = interaction as Partial<OSInteraction> | null | undefined;
	if (!itx || typeof itx.isButton !== 'function' || !itx.isButton()) return;
	if (itx.deferred || itx.replied) return;
	try {
		await itx.defer!();
	} catch (err) {
		Logging.logDebug('Early button defer failed', { error: (err as Error).message, user_id: itx.userId });
	}
}

export async function runCommand({
	commandName,
	args,
	interaction,
	ignoreUserIsBusy,
	isContinue,
	continueDeltaMillis = null
}: RunCommandArgs): CommandResponse {
	const command = globalClient.allCommands.find(c => c.name === commandName)!;

	// Buttons that run a command (repeat trip, open, clue...) get the same early acknowledgement as slash commands,
	// before the command does any database or image work. Slash commands are already deferred on arrival.
	await deferButtonBeforeCommand(interaction);

	const response: Awaited<CommandResponse> = await rawCommandHandlerInner({
		interaction,
		command,
		options: args,
		ignoreUserIsBusy,
		rng: cryptoRng,
		isContinue,
		continueDeltaMs: continueDeltaMillis
	});
	return response;
}
