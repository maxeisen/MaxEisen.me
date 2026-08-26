// Plain HTML for /training when JavaScript is off.
//
// This is a data feed that happens to be readable, not a second copy of the
// dashboard. Bots (and a human with JS off) get headings and tables built from
// the same payload trainingData serves as JSON. A little table CSS lives in
// the noscript block so it never loads for the SPA. The app still boots from
// the shell around it.

import {
	clock,
	daysAgo,
	formatDistance,
	formatDuration,
	pace,
	pct,
	readout,
	shortDate,
	signed,
	signedClock,
	speed,
	timeTaken,
	weekRange,
	weekday,
} from "../../../../src/components/Training/lib/format.js";
import { stravaTag } from "../../../../src/components/Training/lib/runTags.js";

const STRAVA_PROFILE = "https://www.strava.com/athletes/92118908";
const JSON_FEED = "/.netlify/functions/trainingData";

// Lives inside <noscript>, so JS visitors never apply it. Tokens come from
// global.css on the shell; the fallbacks are for a client that skipped CSS.
const FEED_STYLE = `<style>
body { color: var(--paragraph-colour, inherit); max-width: 48rem; margin: 1.25em auto; padding: 0 1em; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0 1.1em; }
th, td { border: 1px solid var(--main-green-translucent, #ccc); padding: 0.28em 0.6em; text-align: left; vertical-align: top; }
th { color: var(--main-green, inherit); font-weight: 600; }
section { margin: 1.1em 0; }
</style>`;

const SEVERITY = {
	critical: "Act now",
	warning: "Watch",
	info: "Note",
	good: "On track",
};

export function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function t(value) {
	return escapeHtml(value);
}

function finite(value) {
	return Number.isFinite(value) ? value : null;
}

/**
 * Drop the text feed into the SPA shell's noscript and advertise the JSON
 * payload as an alternate. The #app mount and the module script stay put.
 *
 * @param {string} html the built index.html
 * @param {string} innerHtml renderTrainingFallback() output
 * @returns {string}
 */
export function injectTrainingFallback(html, innerHtml) {
	let out = String(html ?? "");
	const alternate = `<link rel="alternate" type="application/json" href="${JSON_FEED}">`;
	if (!out.includes(`href="${JSON_FEED}"`) && /<\/head>/i.test(out)) {
		out = out.replace(/<\/head>/i, `    ${alternate}\n</head>`);
	}

	const block = `<noscript>\n${innerHtml}\n</noscript>`;
	if (/<noscript[\s\S]*?<\/noscript>/i.test(out)) {
		return out.replace(/<noscript[\s\S]*?<\/noscript>/i, block);
	}
	if (/<\/body>/i.test(out)) {
		return out.replace(/<\/body>/i, `${block}\n</body>`);
	}
	return `${out}\n${block}`;
}

/**
 * @param {object} data the trainingData payload
 * @returns {string} inner HTML (not a full document)
 */
export function renderTrainingFallback(data = {}) {
	return [
		FEED_STYLE,
		`<p><a href="/">Home</a> · <a href="${JSON_FEED}">JSON</a> · <a href="${STRAVA_PROFILE}" rel="noreferrer">Strava</a></p>`,
		renderHeader(data.summary),
		renderSync(data.sync, data.runs?.length ?? 0),
		renderToday(data.today),
		renderLastRun(data.lastRun),
		renderRecommendations(data.recommendations),
		renderWeek(data.week, data.weeks, data.upcoming, data.today?.date),
		renderLoad(data.summary),
		renderIntensity(data.summary?.intensity),
		renderPrediction(data.summary),
		renderRecovery(data.recovery),
		renderEfficiency(data.summary),
		renderVolume(data.weeks, data.today?.date),
		renderRuns(data.runs, data.summary?.totals?.runs),
		renderFooter(data.sync),
	].filter(Boolean).join("\n");
}

function section(title, body) {
	return `<section>\n<h2>${t(title)}</h2>\n${body}\n</section>`;
}

function pairs(rows) {
	const body = rows
		.filter((row) => row)
		.map(([th, td]) => `<tr><th scope="row">${t(th)}</th><td>${t(td)}</td></tr>`)
		.join("\n");
	return body ? `<table>\n${body}\n</table>` : "";
}

function kmLabel(metres) {
	if (!Number.isFinite(metres)) return "—";
	const value = metres / 1000;
	return value >= 100 ? `${Math.round(value)} km` : `${value.toFixed(1)} km`;
}

function renderHeader(summary) {
	const race = summary?.race || {};
	const prediction = summary?.prediction || null;
	const latest = summary?.latest || null;
	const days = finite(summary?.daysToRace);
	let countdown = "";
	if (days !== null) {
		if (days < 0) countdown = "Race day has passed.";
		else if (days === 0) countdown = "Race day.";
		else countdown = `${days} ${days === 1 ? "day" : "days"} to go.`;
	}

	const raceDate = race.date
		? new Date(`${race.date}T12:00:00Z`).toLocaleDateString("en-GB", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		})
		: "";

	const gain = finite(latest?.ctlGain);
	let trendNote = "no data yet";
	if (latest) {
		trendNote = `form ${signed(latest.tsb, 0)}`;
		if (gain !== null) {
			if (Math.abs(gain) < 1) trendNote += "; holding over 4 weeks";
			else trendNote += gain > 0
				? `; up ${Math.round(gain)} in 4 weeks`
				: `; down ${Math.round(Math.abs(gain))} in 4 weeks`;
		}
	}

	return `<h1>${t(race.name || "Marathon")}</h1>
<p>${[raceDate, countdown].filter(Boolean).map(t).join(" ")}</p>
${pairs([
	["Goal", `${clock(race.goalTimeSec)} (${pace(race.goalPaceSecPerKm)})`],
	["Projected", prediction ? `${clock(prediction.predictedSec)}; ${signedClock(prediction.deltaSec)}` : "needs a hard effort to project from"],
	["Fitness", latest ? `${Math.round(latest.ctl)}; ${trendNote}` : trendNote],
	["Block total", `${kmLabel(summary?.totals?.distanceM)}; ${summary?.totals?.runs || 0} runs`],
])}`;
}

function renderSync(sync, runCount) {
	if (!sync) return "";
	if (!sync.hasSynced && runCount === 0) {
		return `<p><strong>Waiting for the first sync.</strong> Strava history is imported on a schedule rather than on page load, so nothing has landed here yet. This page fills in within about 5 minutes of going live.</p>`;
	}
	if (sync.backfilling) {
		const runs = sync.outstanding === 1 ? "1 run" : `${sync.outstanding} runs`;
		return `<p><strong>Still importing — ${t(runs)} to go.</strong> Fitness, form and the race projection all read the whole block, so treat them as provisional until the import finishes. The most recent weeks are already accurate.</p>`;
	}
	return "";
}

function renderToday(today) {
	if (!today) return section("Today", "<p>No briefing for today yet.</p>");
	const training = today.training;
	const session = today.session;
	const plannedRun = (session?.planned || []).find((s) => s.isRun) || null;

	let sessionTitle = "—";
	let sessionNote = "";
	if (session?.status === "rest") {
		sessionTitle = "Rest";
		sessionNote = "nothing planned";
	} else if (session?.status === "ahead") {
		sessionTitle = plannedRun?.type || "Session";
		sessionNote = [Number.isFinite(plannedRun?.distanceKm) ? `${plannedRun.distanceKm} km` : "", plannedRun?.detail].filter(Boolean).join("; ") || "still ahead";
	} else if (session?.status === "done") {
		sessionTitle = session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "done";
		sessionNote = [Number.isFinite(plannedRun?.distanceKm) ? `of ${plannedRun.distanceKm}` : "", plannedRun?.type].filter(Boolean).join("; ");
	} else if (session) {
		sessionTitle = session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "Extra";
		sessionNote = "unplanned";
	}

	const rows = [
		today.date ? ["Date", shortDate(today.date)] : null,
		training ? ["Fitness", `${signed(training.ctlDelta)} to ${Number.isFinite(training.ctl) ? training.ctl.toFixed(1) : "—"}`] : ["Fitness", "no series yet"],
		training ? ["Fatigue", `${signed(training.atlDelta)} to ${Number.isFinite(training.atl) ? training.atl.toFixed(1) : "—"}`] : null,
		training ? ["Form", `${signed(training.tsbDelta)} to ${Number.isFinite(training.tsb) ? training.tsb.toFixed(1) : "—"}`] : null,
		["Session", sessionNote ? `${sessionTitle}; ${sessionNote}` : sessionTitle],
	];
	return section("Today", pairs(rows));
}

function renderLastRun(run) {
	if (!run) return section("Last run", "<p>Nothing synced yet.</p>");
	const when = [daysAgo(run.daysAgo), shortDate(run.date)].filter(Boolean).join("; ");
	const form = run.impact?.form;
	const href = run.id ? `https://www.strava.com/activities/${encodeURIComponent(run.id)}` : "";
	const name = href
		? `<p><a href="${href}" rel="noreferrer">${t(run.name || "Run")}</a></p>`
		: `<p>${t(run.name || "Run")}</p>`;
	return section("Last run", `${name}
${pairs([
	["When", `${when}${run.effort ? `; ${run.effort}` : ""}`],
	["Distance", formatDistance(run.distanceM)],
	["Moving", timeTaken(run.movingTimeSec)],
	["Pace", pace(run.paceSecPerKm)],
	["Heart rate", run.averageHr > 0 ? String(Math.round(run.averageHr)) : "—"],
	form ? ["Fitness change", signed(form.ctlDelta)] : null,
	form ? ["Fatigue change", signed(form.atlDelta)] : null,
	form ? ["Form change", signed(form.tsbDelta)] : null,
])}`);
}

function renderRecommendations(list) {
	const items = Array.isArray(list) ? list : [];
	if (items.length === 0) {
		return section("Recommendations", "<p>Not enough training data yet to say anything useful.</p>");
	}
	const rows = items.map((rec) => {
		const metric = readout(rec.metric, rec.threshold, rec.unit);
		const label = SEVERITY[rec.severity] || rec.severity || "";
		return `<tr><th scope="row">${t(rec.title)}</th><td>${t(label)}</td><td>${t(metric || "—")}</td><td>${t(rec.detail)}</td></tr>`;
	}).join("\n");
	return section("Recommendations", `<table><thead><tr><th>Advice</th><th>Status</th><th>Metric</th><th>Detail</th></tr></thead><tbody>\n${rows}\n</tbody></table>`);
}

function dayStatus(day) {
	const planned = (day.planned || []).filter((s) => s.isRun);
	const ran = day.actualKm > 0;
	if (planned.length === 0) return ran ? "extra" : "off";
	if (ran) return "done";
	return day.isPast ? "missed" : "ahead";
}

function renderWeek(week, weeks, upcoming, todayKey) {
	const current = (weeks || []).find((w) => w.start === week?.start) || weeks?.find((w) => {
		if (!todayKey || !w.start) return false;
		return w.start <= todayKey && todayKey <= addSix(w.start);
	}) || null;

	if (!current && !week) {
		return section("This week", "<p>No runs logged this week yet.</p>");
	}

	const volume = current
		? `<p>${Number(current.actualKm || 0).toFixed(1)} km${current.targetKm ? ` of ${current.targetKm}` : ""}${current.start ? `; ${t(weekRange(current.start))}` : ""}.</p>`
		: "";

	const days = (week?.days || []).map((day) => {
		const status = dayStatus(day);
		const plan = (day.planned || []).map((s) => `${t(s.type)}${s.detail ? ` ${t(s.detail)}` : ""}`).join(", ") || "—";
		let km = "";
		if (day.actualKm > 0) km = `${day.actualKm.toFixed(1)} km`;
		else if (status === "missed") km = "missed";
		else km = day.planned.find((s) => s.isRun)?.distanceKm != null ? String(day.planned.find((s) => s.isRun).distanceKm) : "";
		return `<tr><th>${t(weekday(day.date))} ${t(String(day.date || "").slice(8, 10))}</th><td>${plan}</td><td>${t(km)}</td></tr>`;
	}).join("");

	const coming = (upcoming || []).slice(0, 4).map((w) =>
		`<tr><th>${t(weekRange(w.start))}</th><td>${w.targetKm ? `${w.targetKm} km` : "—"}</td><td>${w.longRunKm ? `${w.longRunKm} km` : "—"}</td></tr>`,
	).join("");

	return section("This week", `${volume}
${days ? `<table><thead><tr><th>Day</th><th>Plan</th><th>km</th></tr></thead><tbody>${days}</tbody></table>` : ""}
${coming ? `<h3>Coming up</h3><table><thead><tr><th>Week</th><th>Target</th><th>Long run</th></tr></thead><tbody>${coming}</tbody></table>` : ""}`);
}

function addSix(weekStart) {
	const start = new Date(`${weekStart}T12:00:00Z`);
	start.setUTCDate(start.getUTCDate() + 6);
	return start.toISOString().slice(0, 10);
}

function renderLoad(summary) {
	const ratio = finite(summary?.acwr?.ratio);
	const risk = summary?.riskWeek;
	let status = "Not enough history";
	if (ratio !== null) {
		if (ratio > 1.5) status = "Ramping too fast";
		else if (ratio < 0.8) status = "Detraining";
		else status = "In the safe corridor";
	}
	const weekLabel = risk?.isCurrentWeek ? "This week's ramp" : "Last week's ramp";
	const ramp = finite(risk?.rampPct);
	return section("Load and risk", pairs([
		["Acute : chronic", ratio === null ? `—; ${status}` : `${ratio.toFixed(2)}; ${status}`],
		[weekLabel, ramp === null ? "—" : `${ramp > 0 ? "+" : ""}${Math.round(ramp)}%`],
		["Long run share", pct(risk?.longRunSharePct)],
		["7-day load", Number.isFinite(summary?.acwr?.acute) ? String(Math.round(summary.acwr.acute)) : "—"],
		["28-day load", Number.isFinite(summary?.acwr?.chronic) ? String(Math.round(summary.acwr.chronic)) : "—"],
	]));
}

function renderIntensity(intensity) {
	const total = intensity?.totalSec || 0;
	if (!total) return section("Intensity mix", "<p>No runs in the last four weeks.</p>");
	const easy = finite(intensity.easyPct);
	const verdict = easy === null
		? "Not enough data to judge the balance."
		: easy >= 75
			? `${pct(easy)} easy — close enough to the 80% target.`
			: `${pct(easy)} easy, against an 80% target. Your easy days are running too hard.`;
	return section("Intensity mix", `${pairs([
		["Easy", `${pct(intensity.easyPct)}; ${formatDuration(intensity.easySec)}`],
		["Moderate", `${pct(intensity.moderatePct)}; ${formatDuration(intensity.moderateSec)}`],
		["Hard", `${pct(intensity.hardPct)}; ${formatDuration(intensity.hardSec)}`],
	])}
<p>${t(verdict)}</p>`);
}

function renderPrediction(summary) {
	const prediction = summary?.prediction;
	const race = summary?.race || {};
	if (!prediction) {
		return section("Projected finish", "<p>No hard effort of 5 km or longer yet to project from.</p>");
	}
	const basis = prediction.basis;
	const basisLine = basis
		? `<p>Projected from ${t(kmLabel(basis.distanceM))} in ${t(clock(basis.timeSec))}${basis.date ? ` on ${t(shortDate(basis.date))}` : ""}.</p>`
		: "";
	return section("Projected finish", `${pairs([
		["Projected", `${clock(prediction.predictedSec)}; ${signedClock(prediction.deltaSec)}`],
		["Riegel", clock(prediction.riegelSec)],
		["VDOT", `${clock(prediction.vdotSec)}${Number.isFinite(prediction.vdot) ? ` (${prediction.vdot.toFixed(1)})` : ""}`],
		["Goal pace", pace(race.goalPaceSecPerKm)],
	])}
${basisLine}`);
}

function renderRecovery(recovery) {
	if (!recovery) return section("Recovery", "<p>Nothing from the ring yet.</p>");
	const sleep = recovery.sleep || {};
	const restingHr = recovery.restingHr || {};
	const hrv = recovery.hrv || {};
	const shortSleep = Number.isFinite(sleep.recent) && sleep.recent < 7 * 3600;
	const hrUp = Number.isFinite(restingHr.delta) && restingHr.delta >= 5;
	let status = "Not enough nights yet";
	if (Number.isFinite(sleep.recent)) {
		if (shortSleep && hrUp) status = "Not keeping up with the training";
		else if (shortSleep) status = "Sleeping short";
		else if (hrUp) status = "Heart rate up on baseline";
		else status = "Recovering well";
	}
	return section("Recovery", pairs([
		["Average night (7d)", `${Number.isFinite(sleep.recent) ? formatDuration(sleep.recent) : "—"}; ${status}`],
		["Resting HR", Number.isFinite(restingHr.recent) ? `${Math.round(restingHr.recent)} bpm` : "—"],
		["HRV", Number.isFinite(hrv.recent) ? `${Math.round(hrv.recent)} ms` : "—"],
	]));
}

function renderEfficiency(summary) {
	const change = finite(summary?.efficiency?.changePct);
	const longRun = summary?.longRun;
	if (change === null && !longRun) {
		return section("Aerobic efficiency", "<p>Not enough aerobic runs to show a trend yet.</p>");
	}
	const changeText = change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
	return section("Aerobic efficiency", pairs([
		["Change over the block", changeText],
		longRun?.decouplingPct != null ? ["Last long run decoupling", `${Number(longRun.decouplingPct).toFixed(1)}%`] : null,
	]));
}

function renderVolume(weeks, todayKey) {
	const rows = (weeks || []).filter((w) => !todayKey || w.start <= todayKey).slice(-12);
	if (rows.length === 0) return section("Weekly volume", "<p>No weeks logged yet.</p>");
	const body = rows.map((w) =>
		`<tr><th>${t(weekRange(w.start))}</th><td>${Number(w.actualKm || 0).toFixed(1)} km</td><td>${w.targetKm ? `${w.targetKm} km` : "—"}</td><td>${w.runs ?? "—"}</td></tr>`,
	).join("");
	return section("Weekly volume", `<table><thead><tr><th>Week</th><th>Actual</th><th>Target</th><th>Runs</th></tr></thead><tbody>${body}</tbody></table>`);
}

function renderRuns(runs, total) {
	const list = Array.isArray(runs) ? runs : [];
	if (list.length === 0) return section("Recent activity", "<p>Nothing synced yet.</p>");
	const runCount = list.filter((r) => r.sport !== "ride").length;
	const rideCount = list.length - runCount;
	const plannedCount = list.filter((r) => r.plan?.planned).length;
	const summary = `${Number.isFinite(total) && total > runCount ? `latest ${runCount} of ${total}` : `${runCount} runs`}; ${plannedCount} planned${rideCount ? `; ${rideCount} ${rideCount === 1 ? "ride" : "rides"}` : ""}`;
	const rows = list.map((run) => {
		const isRide = run.sport === "ride";
		const tag = stravaTag(run);
		const planned = run.plan?.planned === true;
		const kind = isRide ? "ride" : planned ? t(run.plan?.type || "planned") : "extra";
		const measure = isRide
			? t(speed(run.distanceM, run.movingTimeSec))
			: t(pace(run.paceSecPerKm));
		const href = run.id ? `https://www.strava.com/activities/${encodeURIComponent(run.id)}` : "";
		const name = href
			? `<a href="${href}" rel="noreferrer">${t(run.name || (isRide ? "Ride" : "Run"))}</a>`
			: t(run.name || "");
		return `<tr><td>${t(shortDate(run.startDateLocal))}</td><td>${name}</td><td>${kind}${tag ? `; ${t(tag)}` : ""}</td><td>${t(formatDistance(run.distanceM))}</td><td>${measure}</td></tr>`;
	}).join("");
	return section("Recent activity", `<p>${t(summary)}.</p>
<table><thead><tr><th>Date</th><th>Name</th><th>Kind</th><th>Distance</th><th>Pace / speed</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function renderFooter(sync) {
	const stamp = sync?.lastRunAt
		? `<p>Last synced ${t(new Date(sync.lastRunAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}.</p>`
		: "";
	return `<footer>
<p>Synced from Strava. Metrics are computed deterministically. No route maps. Prefer the <a href="${JSON_FEED}">JSON</a> if you are a machine.</p>
${stamp}
</footer>`;
}
