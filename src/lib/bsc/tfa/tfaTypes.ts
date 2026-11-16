import type { TfaStoredRaid } from '@/lib/bsc/tfa/tfa.js';
import type { ActivityTaskOptions } from '@/lib/types/minions.js';

export interface TFAOptions extends ActivityTaskOptions {
	type: 'FracturedArchive';
	leader: string;
	users: string[];
	quantity: number;
	fakeDuration: number;
	raids: TfaStoredRaid[];
	/** Max team size the leader picked for a mass, reused when the trip is repeated. */
	repeatMaxSize?: number;
}
