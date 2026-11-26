/** Funny Corgo gifs for anyone who tries a staff or admin command they can't use. */
export const gifs = [
	'https://media.giphy.com/media/JwVWLRnZkh2M0/giphy.gif',
	'https://media.giphy.com/media/RcthUYL5L9aZu8BSQL/giphy.gif',
	'https://media.giphy.com/media/sWBzg2D15WwQjHcxbt/giphy.gif',
	'https://media.giphy.com/media/uCAytiJCDsqTS/giphy.gif',
	'https://media.giphy.com/media/ZFFVNwIbjsKtP3lHYK/giphy.gif',
	'https://media.giphy.com/media/3SFw8aZP2HLRa2jZ7i/giphy.gif',
	'https://media.giphy.com/media/VB9zKEpY5NEV7QnJYa/giphy.gif'
];

export function randomCorgoGif(random: () => number = Math.random): string {
	return gifs[Math.min(gifs.length - 1, Math.floor(random() * gifs.length))];
}

/**
 * Refusal reply that shows the Corgo gif as an embed image. A bare giphy link in the message text can be
 * swapped by Discord's own GIF lookup for an unrelated gif, but an embed image always shows the exact file.
 */
export function corgoDeniedReply(random: () => number = Math.random): {
	content: string;
	embeds: { image: { url: string } }[];
} {
	return { content: 'Staff only!', embeds: [{ image: { url: randomCorgoGif(random) } }] };
}
