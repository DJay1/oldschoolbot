import { addTripsToQueue, clearTripQueue, describeTripQueue } from '@/lib/bsc/tripQueue.js';
import { formatQueuedTripLabel } from '@/lib/bsc/tripQueueDisplay.js';
import { fetchRepeatTrips } from '@/lib/util/repeatStoredTrip.js';

export const queueCommand = defineCommand({
	name: 'queue',
	description: 'Queue repeats of a recent trip. Starts after your current trip, or immediately if you are idle.',
	attributes: {
		examples: ['/queue add trip:MonsterKilling times:3', '/queue view', '/queue clear']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'add',
			description: 'Repeat a recent trip. Kill trips list the monster name. Starts now if you are idle.',
			options: [
				{
					type: 'String',
					name: 'trip',
					description:
						'The recent trip to repeat. Monster trips show the monster name, not just Monster Killing.',
					required: true,
					autocomplete: async ({ userId, value }: StringAutoComplete) => {
						const user = await mUserFetch(userId);
						const trips = await fetchRepeatTrips(user);
						const search = value?.toLowerCase() ?? '';
						return trips
							.map(trip => ({
								trip,
								label: formatQueuedTripLabel(trip.type, trip.data)
							}))
							.filter(({ trip, label }) => {
								if (!search) return true;
								return label.toLowerCase().includes(search) || trip.type.toLowerCase().includes(search);
							})
							.map(({ trip, label }) => ({ name: label, value: trip.type }));
					}
				},
				{
					type: 'Integer',
					name: 'times',
					description: 'How many times to repeat that trip.',
					required: true,
					min_value: 1,
					max_value: 18
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'view',
			description: 'See your queued trips, remaining allowance, and when it refills.'
		},
		{
			type: 'Subcommand',
			name: 'clear',
			description: 'Cancel queued trips and refund the unused allowance.'
		}
	],
	run: async ({ options, user, channelId }) => {
		if (options.add) {
			return addTripsToQueue(user, options.add.trip, options.add.times, channelId);
		}
		if (options.clear) {
			const { cleared, refunded } = await clearTripQueue(user.id);
			if (!cleared) return 'Your trip queue was already empty.';
			if (refunded > 0) {
				return `Cleared your trip queue and refunded ${refunded} unused queue point${refunded === 1 ? '' : 's'}.`;
			}
			return 'Cleared your trip queue.';
		}
		return describeTripQueue(user);
	}
});
