// Public Strava snapshot: the homepage, dashboard widget, and /toronto map.
// Distinct from the training index — that one drops polylines on purpose
// (routes reveal home), and it uses different distance/sport filters. This
// module is the feed those surfaces already consumed from a live listing.

export const FEED_CAP = 100;
export const STRAVA_ATHLETE_ID = 92118908;
export const STRAVA_PROFILE_URL = `https://www.strava.com/athletes/${STRAVA_ATHLETE_ID}`;

// Distance thresholds (in metres) for "qualifying" activities — these
// keep the surfaces from listing 1-km warm-up jogs and the like.
export function passesFeedFilter(activity) {
	if (activity?.private === true) return false;
	const type = activity?.sport_type || activity?.type || "";
	const distance = activity?.distance || 0;
	if (/Walk|Hike/i.test(type)) return distance >= 7000;
	if (/Run/i.test(type)) return distance >= 5000;
	if (/Ride/i.test(type)) return distance >= 10000;
	return false;
}

export function shapeFeedItem(activity) {
	if (!activity) return null;
	return {
		id: activity.id,
		name: activity.name,
		type: activity.sport_type || activity.type,
		distance: activity.distance,
		movingTime: activity.moving_time,
		elapsedTime: activity.elapsed_time,
		elevationGain: activity.total_elevation_gain,
		startDate: activity.start_date,
		polyline: activity.map?.summary_polyline || null,
		sufferScore: activity.suffer_score ?? null,
	};
}

/**
 * Rolling public feed. Incoming wins on id (an edited name/polyline should
 * replace the stored copy). Newest startDate first, capped so a backfill
 * cannot grow the blob without bound.
 *
 * @param {object[]} existing
 * @param {object[]} incoming
 * @param {number} [cap]
 * @param {{dropIds?: Array<string|number>}} [options]
 *   Ids a later listing has marked private (or otherwise unfit). Removed
 *   even when they are not in `incoming`, because shapeFeedItem does not
 *   persist the private flag and the stored copy would otherwise linger.
 * @returns {object[]}
 */
export function mergeFeed(existing, incoming, cap = FEED_CAP, { dropIds } = {}) {
	const drop = new Set((dropIds || []).map((id) => String(id)));
	const byId = new Map();
	for (const a of existing || []) {
		if (a?.id == null || drop.has(String(a.id))) continue;
		byId.set(String(a.id), a);
	}
	for (const a of incoming || []) {
		if (a?.id == null || drop.has(String(a.id))) continue;
		byId.set(String(a.id), a);
	}
	return [...byId.values()]
		.sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")))
		.slice(0, cap);
}

export function shapeYtdTotals(t) {
	if (!t) return null;
	return {
		count: t.count || 0,
		distance: t.distance || 0,
		movingTime: t.moving_time || 0,
		elevationGain: t.elevation_gain || 0,
	};
}

export function emptyPublicSnapshot() {
	return {
		activities: [],
		bike: null,
		shoes: null,
		ytd: { run: null, ride: null },
	};
}

/**
 * Slice of the stored snapshot for a public endpoint.
 *
 * @param {object|null} snapshot
 * @param {{activitiesLimit?: number|null}} [options]
 *   When `activitiesLimit` is a number, `activities` is included (capped).
 *   Omit it for the profile-only body.
 * @returns {object}
 */
export function publicSnapshotBody(snapshot, { activitiesLimit = null } = {}) {
	const empty = emptyPublicSnapshot();
	const body = {
		bike: snapshot?.bike ?? empty.bike,
		shoes: snapshot?.shoes ?? empty.shoes,
		ytd: snapshot?.ytd ?? empty.ytd,
	};
	if (activitiesLimit != null) {
		const activities = Array.isArray(snapshot?.activities) ? snapshot.activities : [];
		body.activities = activities.slice(0, activitiesLimit);
	}
	return body;
}
