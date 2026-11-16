import '../../src/lib/util/clientSettings.js';
import { activity_type_enum } from '../../src/prisma/main/enums.js';
import { describe, expect, test } from 'vitest';

import { buildRepeatTripArgs } from '@/lib/util/repeatStoredTrip.js';

const mass = ['1', '2', '3'];

describe('Repeating a mass keeps the max team size the leader picked', () => {
	test('CoX', () => {
		const args = buildRepeatTripArgs(activity_type_enum.Raids, {
			users: mass,
			challengeMode: false,
			quantity: 2,
			repeatMaxSize: 6
		}) as any;
		expect(args.cox.start).toMatchObject({ type: 'mass', max_team_size: 6, quantity: 2 });
	});

	test('ToB', () => {
		const args = buildRepeatTripArgs(activity_type_enum.TheatreOfBlood, {
			users: mass,
			hardMode: false,
			quantity: 1,
			repeatMaxSize: 4
		}) as any;
		expect(args.tob.start.max_team_size).toBe(4);
	});

	test('ToA uses the picked size, not just how many joined last time', () => {
		const args = buildRepeatTripArgs(activity_type_enum.TombsOfAmascut, {
			users: mass,
			raidLevel: 300,
			quantity: 1,
			repeatMaxSize: 8
		}) as any;
		expect(args.toa.start.max_team_size).toBe(8);
		const old = buildRepeatTripArgs(activity_type_enum.TombsOfAmascut, {
			users: mass,
			raidLevel: 300,
			quantity: 1
		}) as any;
		expect(old.toa.start.max_team_size).toBe(3);
	});

	test('DoA', () => {
		const args = buildRepeatTripArgs(activity_type_enum.DepthsOfAtlantis, {
			users: mass,
			cm: false,
			quantity: 1,
			repeatMaxSize: 5
		}) as any;
		expect(args.doa.start.max_team_size).toBe(5);
	});

	test('solo trips and old trips without a stored size fall back to the default', () => {
		const solo = buildRepeatTripArgs(activity_type_enum.Raids, {
			users: ['1'],
			challengeMode: false,
			quantity: 1,
			repeatMaxSize: 6
		}) as any;
		expect(solo.cox.start.max_team_size).toBeUndefined();
		const old = buildRepeatTripArgs(activity_type_enum.DepthsOfAtlantis, { users: mass, cm: false, quantity: 1 }) as any;
		expect(old.doa.start.max_team_size).toBeUndefined();
	});
});