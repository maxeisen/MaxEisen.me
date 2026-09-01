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
		name: displayName(gear),
		distance: gear.distance || 0,
	};
}

// GET /gear returns the athlete's nickname as `name`. Brand + model are the
// catalog fields (Specialized Tarmac SL7, ASICS Superblast 3). Prefer those
// so the homepage doesn't show "Tarmax (on Hunts)". If the model already
// starts with the brand, don't print it twice.
function displayName(gear) {
	const brand = String(gear.brand_name || "").trim();
	const model = String(gear.model_name || "").trim();
	if (brand && model) {
		if (model.toLowerCase().startsWith(brand.toLowerCase())) return model;
		return `${brand} ${model}`;
	}
	return brand || model || gear.name || null;
}
