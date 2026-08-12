// Strava's own label for a run, where it's worth showing.
//
// The run log and the last-run panel both tag a run, and both had their own
// copy of this. It reads as trivia until you notice both copies also carry the
// same judgement call about when to stay quiet, which is the part worth having
// in one place.

/** Strava's `workout_type` on a run. */
export const WORKOUT_TAGS = { 1: "Race", 2: "Long run", 3: "Workout" };

/**
 * Strava's label for a run, or null where it adds nothing.
 *
 * A run matched to a planned session already says what it was, so repeating
 * Strava's word for the same thing gives you "long run · Long run".
 *
 * @param {{workoutType?: number, plan?: {planned?: boolean, type?: string}}} run
 * @returns {string|null}
 */
export function stravaTag(run) {
	const tag = WORKOUT_TAGS[run?.workoutType];
	if (!tag) return null;
	const planType = run?.plan?.planned ? String(run.plan.type || "") : "";
	return tag.toLowerCase() === planType.toLowerCase() ? null : tag;
}
