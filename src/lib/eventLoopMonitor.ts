import { type IntervalHistogram, monitorEventLoopDelay } from 'node:perf_hooks';

/**
 * Event loop lag monitor. Writes a summary line to the perf log every minute and a warning when a
 * short window shows a big stall, at most once per cooldown (suppressed spikes are counted in the next warning).
 * Separate histograms from metrics.ts, so the metrics ticker's reset doesn't interfere.
 */
export const EVENT_LOOP_SAMPLE_MS = 10_000;
export const EVENT_LOOP_SUMMARY_MS = 60_000;
export const EVENT_LOOP_SPIKE_MS = 1000;
export const EVENT_LOOP_WARN_COOLDOWN_MS = 5 * 60_000;

export interface LagWindow {
	p50: number;
	p99: number;
	max: number;
	mean: number;
}

export function readLagWindow(h: Pick<IntervalHistogram, 'percentile' | 'max' | 'mean'>): LagWindow {
	const ms = (ns: number) => Math.round((Number.isFinite(ns) ? ns : 0) / 1e5) / 10;
	return { p50: ms(h.percentile(50)), p99: ms(h.percentile(99)), max: ms(h.max), mean: ms(h.mean) };
}

/** Decides when a spike warning should be written, so a bad minute produces one line, not dozens. */
export class LagSpikeWarner {
	private lastWarnAt = Number.NEGATIVE_INFINITY;
	private suppressed = 0;

	constructor(
		private readonly thresholdMs = EVENT_LOOP_SPIKE_MS,
		private readonly cooldownMs = EVENT_LOOP_WARN_COOLDOWN_MS
	) {}

	check(window: LagWindow, now: number): { warn: false } | { warn: true; suppressed: number } {
		if (window.max < this.thresholdMs) return { warn: false };
		if (now - this.lastWarnAt < this.cooldownMs) {
			this.suppressed++;
			return { warn: false };
		}
		const suppressed = this.suppressed;
		this.suppressed = 0;
		this.lastWarnAt = now;
		return { warn: true, suppressed };
	}
}

export interface EventLoopMonitorDeps {
	writePerf: (line: Record<string, unknown>) => void;
	warn: (message: string, ctx: Record<string, unknown>) => void;
}

let started: { stop: () => void } | null = null;

export function startEventLoopMonitor(deps: EventLoopMonitorDeps) {
	if (started) return started;
	const minute = monitorEventLoopDelay({ resolution: 20 });
	const sample = monitorEventLoopDelay({ resolution: 20 });
	minute.enable();
	sample.enable();
	const warner = new LagSpikeWarner();

	const sampleTimer = setInterval(() => {
		const window = readLagWindow(sample);
		sample.reset();
		const res = warner.check(window, Date.now());
		if (res.warn) {
			deps.warn(`Event loop stalled for up to ${window.max}ms in the last ${EVENT_LOOP_SAMPLE_MS / 1000}s`, {
				...window,
				suppressedSpikes: res.suppressed
			});
		}
	}, EVENT_LOOP_SAMPLE_MS);

	const summaryTimer = setInterval(() => {
		const window = readLagWindow(minute);
		minute.reset();
		deps.writePerf({ text: 'event_loop_lag', windowSec: EVENT_LOOP_SUMMARY_MS / 1000, ...window });
	}, EVENT_LOOP_SUMMARY_MS);

	sampleTimer.unref();
	summaryTimer.unref();

	started = {
		stop: () => {
			clearInterval(sampleTimer);
			clearInterval(summaryTimer);
			minute.disable();
			sample.disable();
			started = null;
		}
	};
	return started;
}
