// Plain HTML for /cycling when JavaScript is off.

const JSON_FEED = "/.netlify/functions/cyclingData";

function esc(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function km(metres) {
	const n = Number(metres) || 0;
	return `${(n / 1000).toFixed(1)} km`;
}

function hours(sec) {
	const s = Number(sec) || 0;
	const h = Math.floor(s / 3600);
	const m = Math.round((s % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * @param {object} data cycling dashboard payload
 * @returns {string}
 */
export function renderCyclingFallback(data) {
	const ride = data?.lastRide;
	const rideBlock = ride
		? `<h2>Last ride</h2><p>${esc(ride.name)} — ${km(ride.distanceM)}, ${hours(ride.movingTimeSec)}</p>`
		: `<h2>Last ride</h2><p>Nothing synced yet.</p>`;
	const advice = (data?.recommendations || [])
		.map((item) => `<li>${esc(item.title)}</li>`)
		.join("");
	const weeks = (data?.weeks || [])
		.map((week) => `<li>${esc(week.start)}: ${Number(week.actualKm || 0).toFixed(1)} km, ${hours(week.movingTimeSec)}</li>`)
		.join("");
	const names = (data?.activities || [])
		.map((activity) => `<li>${esc(activity.name)}</li>`)
		.join("");
	const form = data?.today?.training;
	const today = form
		? `<h2>Today</h2><p>Fitness ${form.ctl.toFixed(1)}, fatigue ${form.atl.toFixed(1)}, form ${form.tsb.toFixed(1)}</p>`
		: "";
	return `<article>
<h1>Cycling</h1>
${today}
${rideBlock}
<h2>Recommendations</h2><ul>${advice}</ul>
<h2>Weekly volume</h2><ul>${weeks}</ul>
<h2>Recent activity</h2><ul>${names}</ul>
<p><a href="${JSON_FEED}">JSON</a></p>
</article>`;
}

/**
 * @param {string} html
 * @param {string} innerHtml
 * @returns {string}
 */
export function injectCyclingFallback(html, innerHtml) {
	let out = String(html ?? "");
	const alternate = `<link rel="alternate" type="application/json" href="${JSON_FEED}">`;
	if (!out.includes(`href="${JSON_FEED}"`) && /<\/head>/i.test(out)) {
		out = out.replace(/<\/head>/i, `    ${alternate}\n</head>`);
	}
	const block = `<noscript>\n${innerHtml}\n</noscript>`;
	if (/<noscript[\s\S]*?<\/noscript>/i.test(out)) {
		return out.replace(/<noscript[\s\S]*?<\/noscript>/i, block);
	}
	return `${out}\n${block}`;
}
