export const helpCommand = defineCommand({
	name: 'help',
	description: 'Get information and help with the bot.',
	options: [],
	run: async () => {
		return {
			content: `Help for **NEED TO REPLACE**.

Use the slash commands to play. If you do not have a minion yet, run \`/minion buy\`.`
		};
	}
});
