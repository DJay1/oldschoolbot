/**
 * Birthday events (BirthdayEvent, BirthdayCollectIngredients) no longer have
 * start commands. Those activity types stay in the database enum so old trips
 * can still be described. Buying birthday crate keys is gated by the registry.
 */
export const birthdayEventId = 'birthday' as const;
