import { ButtonBuilder, ButtonStyle, createInteractionCollector } from '@oldschoolgg/discord';
import { Time } from '@oldschoolgg/toolkit';
import { MathRNG, randInt } from 'node-rng';

/**
 * Multiple-choice buttons for a channel race (spawn lamp / spawn box).
 *
 * `answers[0]` is correct. Buttons are shuffled. Ironmen cannot play unless they
 * spawned it. The lamp creator may guess twice. Custom ids start with `DYN_` so the
 * global button handler leaves them for this collector.
 *
 * The question is the command reply. The command's return value replaces it, which
 * clears the buttons.
 */
/** The spawner can answer alone for this long before everyone else can. */
export const SPAWNER_HEAD_START_MS = 5 * Time.Second;

export async function buttonUserPicker({
	interaction,
	str,
	timer = Time.Minute,
	ironmenAllowed,
	answers,
	creator,
	creatorGetsTwoGuesses,
	creatorHeadStartMs = SPAWNER_HEAD_START_MS
}: {
	interaction: MInteraction;
	str: string;
	timer?: number;
	ironmenAllowed: boolean;
	answers: string[];
	creator: string;
	creatorGetsTwoGuesses?: boolean;
	creatorHeadStartMs?: number;
}): Promise<string | null> {
	const ordered = MathRNG.shuffle([...answers]);
	const nonce = randInt(1, 1_000_000_000).toString(36);
	const idPrefix = `DYN_SPAWN_${nonce}_`;
	const buttons = ordered.map((label, index) =>
		new ButtonBuilder().setCustomId(`${idPrefix}${index}`).setLabel(label).setStyle(ButtonStyle.Secondary)
	);
	const correctIndex = ordered.indexOf(answers[0]);
	if (correctIndex < 0) throw new Error('Spawn answer buttons lost the correct choice.');
	const correctCustomId = `${idPrefix}${correctIndex}`;

	if (!interaction.deferred && !interaction.replied) {
		await interaction.defer();
	}
	const posted = await interaction.replyWithResponse({
		content: str,
		components: buttons,
		withResponse: true
	});
	if (!posted?.message_id) return null;

	const guessed: string[] = [];
	const openToAllAt = Date.now() + creatorHeadStartMs;

	return new Promise(resolve => {
		let settled = false;
		let claimedWin = false;
		const collector = createInteractionCollector({
			interaction,
			channelId: interaction.channelId,
			messageId: posted.message_id,
			timeoutMs: timer,
			// Keep collecting every click until someone wins or time runs out. The default stops after the first click.
			maxCollected: Number.POSITIVE_INFINITY
		});

		const finish = (winnerId: string | null) => {
			if (settled) return;
			settled = true;
			resolve(winnerId);
			collector.stop('done');
		};

		collector.on('collect', async buttonInteraction => {
			if (settled || claimedWin) {
				await buttonInteraction.silentButtonAck().catch(() => undefined);
				return;
			}
			const customId = buttonInteraction.customId;
			if (!customId?.startsWith(idPrefix)) {
				await buttonInteraction.silentButtonAck().catch(() => undefined);
				return;
			}

			try {
				const userId = buttonInteraction.userId;
				const player = await mUserFetch(userId);
				const isCreator = userId === creator;
				if (!ironmenAllowed && player.isIronman && !isCreator) {
					await buttonInteraction.reply({
						ephemeral: true,
						content: "You aren't allowed to participate.."
					});
					return;
				}

				if (!isCreator && Date.now() < openToAllAt) {
					const wait = Math.ceil((openToAllAt - Date.now()) / 1000);
					await buttonInteraction.reply({
						ephemeral: true,
						content: `The spawner gets a head start. You can answer in ${wait}s.`
					});
					return;
				}

				const previousGuesses = guessed.filter(id => id === userId).length;
				if (previousGuesses > 0) {
					const outOfGuesses = !creatorGetsTwoGuesses || !isCreator || previousGuesses >= 2;
					if (outOfGuesses) {
						await buttonInteraction.reply({
							ephemeral: true,
							content: 'You already guessed wrong.'
						});
						return;
					}
				}

				if (customId === correctCustomId) {
					claimedWin = true;
					await buttonInteraction.reply({ ephemeral: true, content: 'You got it!' });
					finish(userId);
					return;
				}

				guessed.push(userId);
				await buttonInteraction.reply({ ephemeral: true, content: 'Wrong!' });
			} catch (err) {
				Logging.logError(err as Error);
				await buttonInteraction
					.reply({ ephemeral: true, content: 'Something went wrong.' })
					.catch(() => undefined);
			}
		});

		collector.on('end', () => finish(null));
		collector.on('error', err => {
			Logging.logError(err as Error);
			finish(null);
		});
	});
}
