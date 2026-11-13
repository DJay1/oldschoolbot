import {
	addTripsToQueue,
	clearTripQueue,
	describeTripQueue,
	scheduleQueuedTrips,
	setQueueReminders,
	unscheduleQueuedTrips
} from '@/lib/bsc/tripQueue.js';
import { formatQueuedTripLabel } from '@/lib/bsc/tripQueueDisplay.js';
import { fetchRepeatTrips } from '@/lib/util/repeatStoredTrip.js';

export const queueCommand = defineCommand({
	name: 'queue',
	description: 'Queue repeats of a recent trip. Starts after your current trip, or immediately if you are idle.',
	attributes: {
		examples: [
			'/queue add trip:MonsterKilling times:3',
			'/queue add trip:Woodcutting times:2 time:22:00 timezone:America/Chicago',
			'/queue view',
			'/queue clear',
			'/queue reminders enabled:true time:22:00 timezone:America/Chicago',
			'/queue schedule time:22:00 timezone:America/Chicago days:5',
			'/queue unschedule'
		]
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
				},
				{
					type: 'String',
					name: 'time',
					description: 'Optional local start time in 24-hour HH:mm format, such as 22:00.'
				},
				{
					type: 'String',
					name: 'timezone',
					description: 'IANA timezone for the start time, such as America/Chicago.'
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
		},
		{
			type: 'Subcommand',
			name: 'reminders',
			description: 'Turn queue reminders on or off; optionally set a local reminder time.',
			options: [
				{
					type: 'Boolean',
					name: 'enabled',
					description: 'Whether queue reminders are enabled.',
					required: true
				},
				{
					type: 'String',
					name: 'time',
					description: 'Optional local reminder time in 24-hour HH:mm format, such as 22:00.'
				},
				{
					type: 'String',
					name: 'timezone',
					description: 'IANA timezone for the local time, such as America/Chicago.'
				},
				{
					type: 'Boolean',
					name: 'clear_time',
					description: 'Clear the custom local reminder time and keep refill reminders enabled.'
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'schedule',
			description: 'Schedule queued trips, optionally add a trip and repeat daily for up to 5 days.',
			options: [
				{
					type: 'String',
					name: 'time',
					description: 'Local start time in 24-hour HH:mm format, such as 22:00.',
					required: true
				},
				{
					type: 'String',
					name: 'timezone',
					description: 'IANA timezone, such as America/Chicago.',
					required: true
				},
				{
					type: 'String',
					name: 'trip',
					description: 'Optional recent trip to add to the queue before scheduling.',
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
					description: 'How many times to queue the trip selected above.',
					min_value: 1,
					max_value: 18
				},
				{
					type: 'Integer',
					name: 'days',
					description: 'Repeat this scheduled queue daily for 1 to 5 days.',
					min_value: 1,
					max_value: 5
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'unschedule',
			description: 'Cancel the scheduled start and any recurring trips, without clearing your queue.'
		}
	],
	run: async ({ options, user, channelId }) => {
		if (options.add) {
			return addTripsToQueue(user, options.add.trip, options.add.times, channelId, {
				scheduleTime: options.add.time,
				scheduleTimezone: options.add.timezone
			});
		}
		if (options.clear) {
			const { cleared, refunded } = await clearTripQueue(user.id);
			if (!cleared) return 'Your trip queue was already empty.';
			if (refunded > 0) {
				return `Cleared your trip queue and refunded ${refunded} unused queue point${refunded === 1 ? '' : 's'}.`;
			}
			return 'Cleared your trip queue.';
		}
		if (options.reminders) {
			return setQueueReminders(
				user,
				options.reminders.enabled,
				options.reminders.time,
				options.reminders.timezone,
				options.reminders.clear_time
			);
		}
		if (options.schedule) {
			return scheduleQueuedTrips(user, options.schedule.time, options.schedule.timezone, channelId, {
				trip: options.schedule.trip,
				times: options.schedule.times,
				days: options.schedule.days
			});
		}
		if (options.unschedule) return unscheduleQueuedTrips(user.id);
		return describeTripQueue(user);
	}
});
