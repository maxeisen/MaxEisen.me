function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=60, stale-while-revalidate=180",
		},
	});
}

const INFO_URL = "https://tor.publicbikesystem.net/customer/gbfs/v2/en/station_information.json";
const STATUS_URL = "https://tor.publicbikesystem.net/customer/gbfs/v2/en/station_status.json";

let cachedInfo = null; // { stations: Map<id, {name, lat, lon}>, expiresAt }

async function loadStationInfo() {
	if (cachedInfo && cachedInfo.expiresAt > Date.now()) {
		return cachedInfo.stations;
	}
	const res = await fetch(INFO_URL);
	if (!res.ok) throw new Error(`station_information failed: ${res.status}`);
	const data = await res.json();
	const map = new Map();
	for (const s of data.data?.stations || []) {
		map.set(s.station_id, { name: s.name, lat: s.lat, lon: s.lon });
	}
	cachedInfo = { stations: map, expiresAt: Date.now() + 1000 * 60 * 60 * 12 };
	return map;
}

export default async function handler() {
	try {
		const [infoMap, statusRes] = await Promise.all([
			loadStationInfo(),
			fetch(STATUS_URL),
		]);
		if (!statusRes.ok) throw new Error(`station_status failed: ${statusRes.status}`);
		const statusData = await statusRes.json();
		const stations = (statusData.data?.stations || [])
			.filter((s) => s.is_renting && s.is_returning && infoMap.has(s.station_id))
			.map((s) => {
				const info = infoMap.get(s.station_id);
				return {
					id: s.station_id,
					name: info.name,
					lat: info.lat,
					lon: info.lon,
					bikes: s.num_bikes_available || 0,
					docks: s.num_docks_available || 0,
				};
			});
		return jsonResponse({ stations });
	} catch (err) {
		console.error(err);
		return jsonResponse({ error: "bikeshare_failed" }, 502);
	}
}
