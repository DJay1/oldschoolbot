import { isEventActive } from '@/lib/events/registry.js';

export function halloweenClaimHoldMessage(): string | null {
	if (isEventActive('halloween')) return null;
	return 'The Halloween event is on hold. Halloween item claims are disabled until it is turned back on.';
}
