/**
 * Small bounded LRU used by the bank/gear renderer so repeated renders reuse prepared sprites
 * instead of allocating a new canvas per item per render. Oldest entries are dropped past `max`.
 */
export class BoundedImageCache<V> {
	private readonly map = new Map<string, V>();

	constructor(public readonly max: number) {}

	get size() {
		return this.map.size;
	}

	get(key: string): V | undefined {
		const value = this.map.get(key);
		if (value !== undefined) {
			// Refresh recency.
			this.map.delete(key);
			this.map.set(key, value);
		}
		return value;
	}

	set(key: string, value: V) {
		if (this.map.has(key)) this.map.delete(key);
		this.map.set(key, value);
		while (this.map.size > this.max) {
			const oldest = this.map.keys().next().value;
			if (oldest === undefined) break;
			this.map.delete(oldest);
		}
	}

	getOrCreate(key: string, create: () => V): V {
		const existing = this.get(key);
		if (existing !== undefined) return existing;
		const value = create();
		this.set(key, value);
		return value;
	}

	clear() {
		this.map.clear();
	}
}

const sourceIds = new WeakMap<object, number>();
let nextSourceId = 1;

/** Stable id for an image object, so cache keys can tell a painted/custom sprite from the plain icon. */
export function imageSourceId(image: object): number {
	let id = sourceIds.get(image);
	if (id === undefined) {
		id = nextSourceId++;
		sourceIds.set(image, id);
	}
	return id;
}
/** How many bank items to draw before letting the event loop run other work. */
export const RENDER_YIELD_EVERY = 150;

export function yieldToEventLoop(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}
