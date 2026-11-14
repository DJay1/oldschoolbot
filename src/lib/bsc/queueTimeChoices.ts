/** Dropdown choices for /queue start and reminder times. Values stay HH:mm so stored schedules keep working. */
export const QUEUE_TIME_CHOICES: { name: string; value: string }[] = Array.from({ length: 24 }, (_, hour) => {
	const h12 = hour % 12 === 0 ? 12 : hour % 12;
	const suffix = hour < 12 ? 'AM' : 'PM';
	const label = hour === 0 ? '12 AM (midnight)' : hour === 12 ? '12 PM (noon)' : `${h12} ${suffix}`;
	return { name: label, value: `${String(hour).padStart(2, '0')}:00` };
});

/** Dropdown choices for /queue timezones. Values are IANA zones so daylight saving is handled. */
export const QUEUE_TIMEZONE_CHOICES: { name: string; value: string; short: string }[] = [
	{ name: 'CT (Central US)', value: 'America/Chicago', short: 'CT' },
	{ name: 'ET (Eastern US)', value: 'America/New_York', short: 'ET' },
	{ name: 'MT (Mountain US)', value: 'America/Denver', short: 'MT' },
	{ name: 'MST (Arizona, no daylight saving)', value: 'America/Phoenix', short: 'Arizona' },
	{ name: 'PT (Pacific US)', value: 'America/Los_Angeles', short: 'PT' },
	{ name: 'AKT (Alaska)', value: 'America/Anchorage', short: 'AKT' },
	{ name: 'HT (Hawaii)', value: 'Pacific/Honolulu', short: 'HT' },
	{ name: 'UTC / GMT', value: 'UTC', short: 'UTC' },
	{ name: 'UK (London)', value: 'Europe/London', short: 'UK' },
	{ name: 'CET (Central Europe)', value: 'Europe/Berlin', short: 'CET' },
	{ name: 'AEST (Sydney)', value: 'Australia/Sydney', short: 'AEST' }
];

export const queueTimeOptionChoices = QUEUE_TIME_CHOICES.map(({ name, value }) => ({ name, value }));
export const queueTimezoneOptionChoices = QUEUE_TIMEZONE_CHOICES.map(({ name, value }) => ({ name, value }));

/** Short name for a timezone in replies, e.g. 'CT' for America/Chicago. Unknown zones are shown as-is. */
export function queueTimezoneLabel(timezone: string): string {
	return QUEUE_TIMEZONE_CHOICES.find(choice => choice.value === timezone)?.short ?? timezone;
}

/** Friendly label for an HH:mm time, e.g. '10 PM' for 22:00. Non-hourly legacy times are shown as-is. */
export function queueTimeLabel(time: string): string {
	return QUEUE_TIME_CHOICES.find(choice => choice.value === time)?.name.replace(/ \((midnight|noon)\)$/, '') ?? time;
}
