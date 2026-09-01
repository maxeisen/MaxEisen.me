// Gear attached to the most recent run / ride, used by the homepage
// activity modals. Strava's `primary` flag on GET /athlete no longer tracks
// the per-sport default, so we walk the activity listing (newest first) and
// take the first matching activity that has a gear_id.

const KIND_RE = {
	run: /Run/i,
	ride: /Ride/i,
};

export function mostRecentGearId(activities, kind) {
	if (!Array.isArray(activities)) return null;
	const re = KIND_RE[kind];
	if (!re) return null;
	for (const a of activities) {
		const type = a.sport_type || a.type || "";
		if (re.test(type) && a.gear_id) return a.gear_id;
	}
	return null;
}

export function shapeGear(gear) {
	if (!gear) return null;
	return {
		id: gear.id,
		name: gear.name || null,
		distance: gear.distance || 0,
	};
}
