import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Upload missing application emojis and write assets/emojis/application-emoji-ids.json.
 *
 * Idempotent: an emoji whose name already exists on the application is reused
 * and not uploaded again. Nothing is deleted. Re-run it after adding a PNG.
 *
 *   pnpm emojis:sync
 *   pnpm emojis:sync -- --dry-run
 *
 * Requires CLIENT_ID and BOT_TOKEN (from the environment or .env).
 * Discord docs: https://discord.com/developers/docs/resources/emoji#emoji-resource
 */

const API = 'https://discord.com/api/v10';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATH = join(ROOT, 'assets/emojis/manifest.json');
const IDS_PATH = join(ROOT, 'assets/emojis/application-emoji-ids.json');
const MAX_BYTES = 256 * 1024;
const NAME_RE = /^[A-Za-z0-9_]{2,32}$/;

interface ManifestEntry {
	name: string;
	uploadName: string;
	image: string | null;
	animated: boolean;
}

interface Manifest {
	emojis: ManifestEntry[];
}

interface DiscordEmoji {
	id: string;
	name: string;
	animated?: boolean;
}

function loadEnvFile(): void {
	const path = join(ROOT, '.env');
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function loadManifest(): Manifest {
	const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
	if (!Array.isArray(raw.emojis)) throw new Error('manifest.json is missing an emojis array');
	return raw;
}

async function discord(path: string, token: string, init: RequestInit = {}): Promise<Response> {
	for (let attempt = 0; attempt < 8; attempt++) {
		const response = await fetch(`${API}${path}`, {
			...init,
			headers: {
				Authorization: `Bot ${token}`,
				'Content-Type': 'application/json',
				'User-Agent': 'LosPerrosEmojiSync (https://github.com/DJay1/oldschoolbot, 1.0)',
				...(init.headers ?? {})
			}
		});
		if (response.status !== 429) return response;
		const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
		const waitMs = Math.ceil((body.retry_after ?? 1) * 1000) + 250;
		console.log(`Rate limited. Waiting ${waitMs}ms.`);
		await sleep(waitMs);
	}
	throw new Error(`Discord kept rate limiting ${path}`);
}

function readEmojiList(body: unknown): DiscordEmoji[] {
	if (Array.isArray(body)) return body as DiscordEmoji[];
	if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
		return (body as { items: DiscordEmoji[] }).items;
	}
	throw new Error(`Unexpected emoji list shape: ${JSON.stringify(body).slice(0, 400)}`);
}

function writeIds(ids: Record<string, string>): void {
	const sorted = Object.fromEntries(Object.entries(ids).sort(([a], [b]) => a.localeCompare(b)));
	writeFileSync(IDS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function main(): Promise<void> {
	loadEnvFile();
	const dryRun = process.argv.includes('--dry-run');
	const manifest = loadManifest();
	const uploadable = manifest.emojis.filter(entry => entry.image);
	const missingArt = manifest.emojis.filter(entry => !entry.image);

	console.log(`${uploadable.length} emoji image(s) in the manifest, ${missingArt.length} still need art.`);

	for (const entry of uploadable) {
		if (!NAME_RE.test(entry.uploadName)) {
			throw new Error(`Invalid Discord emoji name "${entry.uploadName}"`);
		}
		const file = join(ROOT, 'assets/emojis', entry.image as string);
		if (!existsSync(file)) throw new Error(`Missing image file for ${entry.name}: ${file}`);
		const bytes = readFileSync(file).byteLength;
		if (bytes > MAX_BYTES) throw new Error(`${entry.image} is ${bytes} bytes; Discord's limit is 256KB`);
	}

	if (dryRun) {
		console.log('Dry run: not contacting Discord.');
		for (const entry of uploadable) console.log(`would sync ${entry.uploadName} <- ${entry.image}`);
		return;
	}

	const token = process.env.BOT_TOKEN;
	const applicationId = process.env.CLIENT_ID;
	if (!token || !applicationId) {
		throw new Error('Set CLIENT_ID and BOT_TOKEN in the environment or in .env, then re-run pnpm emojis:sync.');
	}

	const listResponse = await discord(`/applications/${applicationId}/emojis`, token);
	if (!listResponse.ok) {
		throw new Error(`GET application emojis failed (${listResponse.status}): ${await listResponse.text()}`);
	}
	const existing = readEmojiList(await listResponse.json());
	const byName = new Map(existing.map(emoji => [emoji.name.toLowerCase(), emoji]));
	const ids: Record<string, string> = {};
	let created = 0;
	let reused = 0;

	for (const entry of uploadable) {
		const found = byName.get(entry.uploadName.toLowerCase());
		if (found) {
			ids[entry.uploadName] = found.id;
			reused++;
			console.log(`keep  ${entry.uploadName} ${found.id}`);
			continue;
		}
		const file = join(ROOT, 'assets/emojis', entry.image as string);
		const encoded = readFileSync(file).toString('base64');
		const mime = entry.image?.endsWith('.gif') ? 'image/gif' : 'image/png';
		const response = await discord(`/applications/${applicationId}/emojis`, token, {
			method: 'POST',
			body: JSON.stringify({ name: entry.uploadName, image: `data:${mime};base64,${encoded}` })
		});
		if (response.status === 400) {
			// Lost a race with another sync, or the name exists under different casing.
			const again = await discord(`/applications/${applicationId}/emojis`, token);
			const fresh = readEmojiList(await again.json());
			const match = fresh.find(emoji => emoji.name.toLowerCase() === entry.uploadName.toLowerCase());
			if (match) {
				ids[entry.uploadName] = match.id;
				byName.set(match.name.toLowerCase(), match);
				reused++;
				console.log(`keep  ${entry.uploadName} ${match.id}`);
				continue;
			}
		}
		if (!response.ok) {
			const detail = await response.text();
			throw new Error(`Failed to upload ${entry.uploadName} (${response.status}): ${detail}`);
		}
		const createdEmoji = (await response.json()) as DiscordEmoji;
		if (!createdEmoji.id) throw new Error(`Upload of ${entry.uploadName} returned no id`);
		ids[entry.uploadName] = createdEmoji.id;
		byName.set(createdEmoji.name.toLowerCase(), createdEmoji);
		created++;
		console.log(`add   ${entry.uploadName} ${createdEmoji.id}`);
		await sleep(750);
	}

	writeIds(ids);
	console.log(`Wrote ${IDS_PATH}`);
	console.log(`Reused ${reused}, uploaded ${created}. Commit application-emoji-ids.json and restart the bot.`);
	if (missingArt.length > 0) {
		console.log(`${missingArt.length} name(s) have no image yet and were left on their text fallback.`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
