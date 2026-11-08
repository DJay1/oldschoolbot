import { addTripsToQueue, clearTripQueue, describeTripQueue } from '@/lib/bsc/tripQueue.js';
import { fetchRepeatTrips } from '@/lib/util/repeatStoredTrip.js';

export const queueCommand = defineCommand({
	name: 'queue',
	description: 'Line up repeats of a recent trip. Free players get 2 every 2 days; each patron tier adds 1.',
	attributes: {
		examples: ['/queue add trip:MonsterKilling times:3', '/queue view', '/queue clear']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'add',
			description: 'Queue repeats of one of your recent trips.',
			options: [
				{
					type: 'String',
					name: 'trip',
					description: 'The recent trip to repeat.',
					required: true,
					autocomplete: async ({ userId, value }: StringAutoComplete) => {
						const user = await mUserFetch(userId);
						const trips = await fetchRepeatTrips(user);
						const search = value?.toLowerCase() ?? '';
						return trips
							.filter(trip => !search || trip.type.toLowerCase().includes(search))
							.map(trip => ({ name: trip.type, value: trip.type }));
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
			description: 'See what is in your trip queue.'
		},
		{
			type: 'Subcommand',
			name: 'clear',
			description: 'Clear your trip queue.'
		}
	],
	run: async ({ options, user }) => {
		if (options.add) {
			return addTripsToQueue(user, options.add.trip, options.add.times);
		}
		if (options.clear) {
			const hadQueue = await clearTripQueue(user.id);
			return hadQueue ? 'Cleared your trip queue.' : 'Your trip queue was already empty.';
		}
		return describeTripQueue(user);
	}
});
