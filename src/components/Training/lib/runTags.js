// Strava's own label for a run, where it's worth showing.

/** Strava's `workout_type` on a run. */
export const WORKOUT_TAGS = { 1: "Race", 2: "Long run", 3: "Workout" };

/**
 * Strava's label for a run, or null where a planned session already says it.
 */
export function stravaTag(run) {
	const tag = WORKOUT_TAGS[run?.workoutType];
	if (!tag) return null;
	const planType = run?.plan?.planned ? String(run.plan.type || "") : "";
	return tag.toLowerCase() === planType.toLowerCase() ? null : tag;
}
