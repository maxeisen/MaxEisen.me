// Public Strava snapshot: the homepage and dashboard widget.
// Distinct from the training index — that one drops polylines on purpose
// (routes reveal home), and it uses different distance/sport filters. This
// module is the feed those surfaces already consumed from a live listing.

export const FEED_CAP = 100;
export const STRAVA_ATHLETE_ID = 92118908;
export const STRAVA_PROFILE_URL = `https://www.strava.com/athletes/${STRAVA_ATHLETE_ID}`;

// Strava hands the owner every activity, including ones they've hidden from
// other people. Only "everyone" activities belong on a public surface. Older
// payloads (and test fixtures) carry no `visibility`, so absent means public
// and `private` stays the backstop.
export function isPubliclyVisible(activity) {
	if (activity?.private === true) return false;
	const visibility = activity?.visibility;
	return visibility == null || visibility === "everyone";
}

// Distance thresholds (in metres) for "qualifying" activities — these
// keep the surfaces from listing 1-km warm-up jogs and the like.
export function passesFeedFilter(activity) {
	if (!isPubliclyVisible(activity)) return false;
	const type = activity?.sport_type || activity?.type || "";
	const distance = activity?.distance || 0;
	if (/Walk|Hike/i.test(type)) return distance >= 7000;
	if (/Run/i.test(type)) return distance >= 5000;
	if (/Ride/i.test(type)) return distance >= 10000;
	return false;
}

// Decode a Google-encoded polyline string into an array of [lat,lng] pairs.
export function decodePolyline(str, precision = 5) {
	if (!str) return [];
	const factor = Math.pow(10, precision);
	const len = str.length;
	let index = 0, lat = 0, lng = 0;
	const points = [];
	while (index < len) {
		let b, shift = 0, result = 0;
		do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && index < len);
		lat += (result & 1) ? ~(result >> 1) : (result >> 1);
		shift = 0; result = 0;
		do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && index < len);
		lng += (result & 1) ? ~(result >> 1) : (result >> 1);
		points.push([lat / factor, lng / factor]);
	}
	return points;
}

// The widgets draw a thumbnail of each route, which needs its shape and
// nothing else. The encoded polyline the owner's token gets back is the whole
// route with real coordinates — Strava's privacy zones only trim what OTHER
// people see — so publishing it puts the start and finish (usually home) in a
// public JSON response. Instead the route is reduced to a shape: fitted to a
// ROUTE_GRID square (aspect kept, top-left at 0,0), rounded to whole units
// and thinned to at most ROUTE_MAX_POINTS. No position, no scale.
export const ROUTE_GRID = 1000;
export const ROUTE_MAX_POINTS = 80;

/**
 * @param {string|null|undefined} encoded Google-encoded polyline.
 * @param {number} [maxPoints]
 * @returns {number[][]|null} [x, y] pairs, y growing downward (SVG order).
 */
export function routeShape(encoded, maxPoints = ROUTE_MAX_POINTS) {
	const pts = decodePolyline(encoded);
	if (pts.length < 2) return null;
	let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
	for (const [lat, lng] of pts) {
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
		if (lng < minLng) minLng = lng;
		if (lng > maxLng) maxLng = lng;
	}
	const span = Math.max(maxLat - minLat, maxLng - minLng) || 1;
	const step = Math.max(1, (pts.length - 1) / Math.max(1, maxPoints - 1));
	const out = [];
	for (let f = 0; Math.round(f) < pts.length; f += step) {
		const [lat, lng] = pts[Math.round(f)];
		out.push([
			Math.round(((lng - minLng) / span) * ROUTE_GRID),
			Math.round(((maxLat - lat) / span) * ROUTE_GRID),
		]);
	}
	const [lastLat, lastLng] = pts[pts.length - 1];
	const last = [
		Math.round(((lastLng - minLng) / span) * ROUTE_GRID),
		Math.round(((maxLat - lastLat) / span) * ROUTE_GRID),
	];
	const tail = out[out.length - 1];
	if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
	return out;
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
		route: routeShape(activity.map?.summary_polyline),
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

// Snapshots written before routes replaced polylines still hold the encoded
// string. Never let it out: convert on the way through until the next sync
// rewrites the blob.
function publicFeedItem(item) {
	if (!item || !("polyline" in item)) return item;
	const { polyline, ...rest } = item;
	return { ...rest, route: rest.route ?? routeShape(polyline) };
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
		body.activities = activities.slice(0, activitiesLimit).map(publicFeedItem);
	}
	return body;
}
