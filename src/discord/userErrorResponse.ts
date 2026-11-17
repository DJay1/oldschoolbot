import { SpecialResponse } from '@oldschoolgg/discord';

type RepliableInteraction = {
	replied: boolean;
	followUp: (options: { content: string }) => Promise<unknown>;
};

/**
 * A UserError is a player-facing reason (missing levels, items, an activity already running...).
 * Commands are deferred as soon as they arrive, so returning nothing here leaves "thinking..." forever.
 * If the command already posted its own reply (for example a mass/party message), send the reason as a
 * follow-up instead of overwriting that message.
 */
export async function userErrorResponse(
	err: Error,
	interaction: RepliableInteraction
): Promise<{ content: string } | SpecialResponse.RespondedManually> {
	const content = err.message || 'That command could not be completed.';
	if (!interaction.replied) return { content };
	try {
		await interaction.followUp({ content });
	} catch (followUpErr) {
		Logging.logError(followUpErr as Error, { source: 'userErrorFollowUp' });
	}
	return SpecialResponse.RespondedManually;
}