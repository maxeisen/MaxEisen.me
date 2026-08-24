// HTML for /training when JavaScript is off.
//
// The SPA fetches JSON from trainingData and lays it out in the browser. A
// browser that never runs that code still hits /training, so this module turns
// the same payload into a document the noscript slot can hold: headlines,
// advice, this week, the last run, and the log. Charts, rearrange, and live
// polling stay on the JS side.

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
	splitLead,
	timeTaken,
	weekRange,
	weekday,
} from "../../../../src/components/Training/lib/format.js";
import { stravaTag } from "../../../../src/components/Training/lib/runTags.js";

const STRAVA_PROFILE = "https://www.strava.com/athletes/92118908";
const FALLBACK_CSS = "/styles/training-fallback.css";

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
 * Drop the training HTML into the SPA shell's noscript, and point at the
 * fallback stylesheet. The #app mount and the module script stay put so a
 * JS-capable browser still boots the dashboard.
 *
 * @param {string} html the built index.html
 * @param {string} innerHtml renderTrainingFallback() output
 * @returns {string}
 */
export function injectTrainingFallback(html, innerHtml) {
	let out = String(html ?? "");
	if (!out.includes(FALLBACK_CSS) && /<\/head>/i.test(out)) {
		out = out.replace(/<\/head>/i, `    <link rel="stylesheet" href="${FALLBACK_CSS}">\n</head>`);
	}

	const block = `<noscript>\n<div class="training-fallback">\n${innerHtml}\n</div>\n</noscript>`;
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
		'<a class="tf-back" href="/">← back</a>',
		renderHeader(data.summary),
		renderSync(data.sync, data.runs?.length ?? 0),
		renderToday(data.today),
		'<div class="tf-grid">',
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
		"</div>",
		renderFooter(data.sync),
	].join("\n");
}

function renderHeader(summary) {
	const race = summary?.race || {};
	const prediction = summary?.prediction || null;
	const latest = summary?.latest || null;
	const days = finite(summary?.daysToRace);
	let countdown = "";
	if (days !== null) {
		if (days < 0) countdown = `<div class="tf-countdown"><span class="tf-countdown-value">Done</span><span>race day has passed</span></div>`;
		else if (days === 0) countdown = `<div class="tf-countdown"><span class="tf-countdown-value">Today</span><span>race day</span></div>`;
		else {
			const label = days === 1 ? "day to go" : "days to go";
			countdown = `<div class="tf-countdown"><span class="tf-countdown-value">${days}</span><span>${label}</span></div>`;
		}
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
	let trendNote = "";
	if (gain !== null) {
		if (Math.abs(gain) < 1) trendNote = "holding over 4 weeks";
		else trendNote = gain > 0 ? `up ${Math.round(gain)} in 4 weeks` : `down ${Math.round(Math.abs(gain))} in 4 weeks`;
	}

	const projectedClass = prediction?.onTrack ? "ahead" : prediction ? "behind" : "";

	return `<header class="tf-header">
		<div>
			<p class="tf-eyebrow">Training for</p>
			<h1>${t(race.name || "Marathon")}</h1>
			${raceDate ? `<p class="tf-race-date">${t(raceDate)}</p>` : ""}
		</div>
		${countdown}
	</header>
	<div class="tf-stats">
		${stat("Goal", clock(race.goalTimeSec), pace(race.goalPaceSecPerKm))}
		${stat("Projected", prediction ? clock(prediction.predictedSec) : "—", prediction ? signedClock(prediction.deltaSec) : "needs a hard effort to project from", projectedClass)}
		${stat("Fitness", latest ? String(Math.round(latest.ctl)) : "—", latest ? `form ${signed(latest.tsb, 0)}${trendNote ? ` · ${trendNote}` : ""}` : "no data yet")}
		${stat("Block total", kmLabel(summary?.totals?.distanceM), `${summary?.totals?.runs || 0} runs`)}
	</div>`;
}

function kmLabel(metres) {
	if (!Number.isFinite(metres)) return "—";
	const value = metres / 1000;
	return value >= 100 ? `${Math.round(value)} km` : `${value.toFixed(1)} km`;
}

function stat(label, value, note, valueClass = "") {
	return `<div class="tf-stat">
		<span class="tf-label">${t(label)}</span>
		<strong class="${valueClass}">${t(value)}</strong>
		<span class="tf-note">${t(note)}</span>
	</div>`;
}

function renderSync(sync, runCount) {
	if (!sync) return "";
	if (!sync.hasSynced && runCount === 0) {
		return notice("Waiting for the first sync", "Strava history is imported on a schedule rather than on page load, so nothing has landed here yet. This page fills in within about 5 minutes of going live.");
	}
	if (sync.backfilling) {
		const runs = sync.outstanding === 1 ? "1 run" : `${sync.outstanding} runs`;
		return notice(`Still importing — ${runs} to go`, "Fitness, form and the race projection all read the whole block, so treat them as provisional until the import finishes. The most recent weeks are already accurate.");
	}
	return "";
}

function notice(title, detail) {
	return `<div class="tf-notice" role="status"><strong>${t(title)}</strong><p>${t(detail)}</p></div>`;
}

function renderToday(today) {
	if (!today) return card("Today", `<p class="tf-empty">No briefing for today yet.</p>`);
	const training = today.training;
	const session = today.session;
	const changes = training
		? [
			["Fitness", training.ctlDelta, training.ctl],
			["Fatigue", training.atlDelta, training.atl],
			["Form", training.tsbDelta, training.tsb],
		]
			.map(([label, delta, value]) => `<div><span class="tf-label">${t(label)}</span><strong>${t(signed(delta))}</strong><span class="tf-note">to ${Number.isFinite(value) ? value.toFixed(1) : "—"}</span></div>`)
			.join("")
		: `<p class="tf-empty">No fitness series yet.</p>`;

	let sessionTitle = "—";
	let sessionNote = "";
	const plannedRun = (session?.planned || []).find((s) => s.isRun) || null;
	if (session?.status === "rest") {
		sessionTitle = "Rest";
		sessionNote = "nothing planned";
	} else if (session?.status === "ahead") {
		sessionTitle = plannedRun?.type || "Session";
		sessionNote = [Number.isFinite(plannedRun?.distanceKm) ? `${plannedRun.distanceKm} km` : "", plannedRun?.detail].filter(Boolean).join(" · ") || "still ahead";
	} else if (session?.status === "done") {
		sessionTitle = session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "done";
		sessionNote = [Number.isFinite(plannedRun?.distanceKm) ? `of ${plannedRun.distanceKm}` : "", plannedRun?.type].filter(Boolean).join(" · ");
	} else if (session) {
		sessionTitle = session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "Extra";
		sessionNote = "unplanned";
	}

	const aside = today.date ? `<span>${t(shortDate(today.date))}</span>` : "";
	return card("Today", `<div class="tf-today">
		<div><span class="tf-label">Training</span><div class="tf-changes">${changes}</div></div>
		<div><span class="tf-label">Session</span><strong>${t(sessionTitle)}</strong>${sessionNote ? `<p class="tf-note">${t(sessionNote)}</p>` : ""}</div>
	</div>`, aside);
}

function renderLastRun(run) {
	if (!run) return card("Last run", `<p class="tf-empty">Nothing synced yet.</p>`);
	const when = [daysAgo(run.daysAgo), shortDate(run.date)].filter(Boolean).join(" · ");
	const form = run.impact?.form;
	const href = run.id ? `https://www.strava.com/activities/${encodeURIComponent(run.id)}` : "";
	const title = href
		? `<a class="tf-run-title" href="${href}" rel="noreferrer">${t(run.name || "Run")}</a>`
		: `<strong class="tf-run-title">${t(run.name || "Run")}</strong>`;
	const impact = form
		? `<div class="tf-changes">
			<div><span class="tf-label">Fitness</span><strong>${t(signed(form.ctlDelta))}</strong></div>
			<div><span class="tf-label">Fatigue</span><strong>${t(signed(form.atlDelta))}</strong></div>
			<div><span class="tf-label">Form</span><strong>${t(signed(form.tsbDelta))}</strong></div>
		</div>`
		: "";
	return card("Last run", `${title}
		<p class="tf-note">${t(when)}${run.effort ? ` · ${t(run.effort)}` : ""}</p>
		<div class="tf-stats tf-stats-tight">
			${stat("Distance", formatDistance(run.distanceM), "")}
			${stat("Moving", timeTaken(run.movingTimeSec), "")}
			${stat("Pace", pace(run.paceSecPerKm), "")}
			${stat("Heart rate", run.averageHr > 0 ? String(Math.round(run.averageHr)) : "—", "")}
		</div>
		${impact}`, when ? `<span>${t(when)}</span>` : "");
}

function renderRecommendations(list) {
	const items = Array.isArray(list) ? list : [];
	if (items.length === 0) {
		return card("What to do about it", `<p class="tf-empty">Not enough training data yet to say anything useful.</p>`);
	}
	const rows = items.map((rec) => {
		const { lead, rest } = splitLead(rec.detail);
		const metric = readout(rec.metric, rec.threshold, rec.unit);
		const restBlock = rest
			? `<details><summary>Why this matters</summary><p>${t(rest)}</p></details>`
			: "";
		return `<li class="tf-rec tf-rec-${t(rec.severity || "info")}">
			<p class="tf-rec-meta">${t(SEVERITY[rec.severity] || rec.severity || "")}${metric ? ` · ${t(metric)}` : ""}</p>
			<h3>${t(rec.title)}</h3>
			<p>${t(lead)}</p>
			${restBlock}
		</li>`;
	}).join("");
	return card("What to do about it", `<ul class="tf-recs">${rows}</ul>`);
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
		return card("This week", `<p class="tf-empty">No runs logged this week yet.</p>`);
	}

	const progress = current?.targetKm > 0
		? Math.min(100, (current.actualKm / current.targetKm) * 100)
		: null;
	const volume = current
		? `<p><strong>${Number(current.actualKm || 0).toFixed(1)} km</strong>${current.targetKm ? ` of ${current.targetKm}` : ""}</p>${progress !== null ? `<div class="tf-track" aria-hidden="true"><div class="tf-fill" style="width:${progress}%"></div></div>` : ""}`
		: "";

	const days = (week?.days || []).map((day) => {
		const status = dayStatus(day);
		const plan = (day.planned || []).map((s) => `${t(s.type)}${s.detail ? ` ${t(s.detail)}` : ""}`).join(", ") || "—";
		let km = "";
		if (day.actualKm > 0) km = `${day.actualKm.toFixed(1)} km`;
		else if (status === "missed") km = "missed";
		else km = day.planned.find((s) => s.isRun)?.distanceKm != null ? `${day.planned.find((s) => s.isRun).distanceKm}` : "";
		return `<tr class="${day.isToday ? "today" : ""}"><th>${t(weekday(day.date))} ${t(String(day.date || "").slice(8, 10))}</th><td>${plan}</td><td>${t(km)}</td></tr>`;
	}).join("");

	const coming = (upcoming || []).slice(0, 4).map((w) =>
		`<li>${t(weekRange(w.start))} · ${w.targetKm ? `${w.targetKm} km` : "—"}${w.longRunKm ? ` · ${w.longRunKm} km long` : ""}</li>`,
	).join("");

	return card("This week", `${volume}
		${days ? `<table class="tf-days"><thead><tr><th>Day</th><th>Plan</th><th>km</th></tr></thead><tbody>${days}</tbody></table>` : ""}
		${coming ? `<h3>Coming up</h3><ul class="tf-upcoming">${coming}</ul>` : ""}`,
	current?.start ? `<span>${t(weekRange(current.start))}</span>` : "");
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
	const weekLabel = risk?.isCurrentWeek ? "This week's" : "Last week's";
	const ramp = finite(risk?.rampPct);
	return card("Load and risk", `<p><strong>${ratio === null ? "—" : ratio.toFixed(2)}</strong> acute : chronic · ${t(status)}</p>
		<dl class="tf-dl">
			<div><dt>${t(weekLabel)} ramp</dt><dd>${ramp === null ? "—" : `${ramp > 0 ? "+" : ""}${Math.round(ramp)}%`}</dd></div>
			<div><dt>Long run share</dt><dd>${t(pct(risk?.longRunSharePct))}</dd></div>
			<div><dt>7-day load</dt><dd>${Number.isFinite(summary?.acwr?.acute) ? Math.round(summary.acwr.acute) : "—"}</dd></div>
			<div><dt>28-day load</dt><dd>${Number.isFinite(summary?.acwr?.chronic) ? Math.round(summary.acwr.chronic) : "—"}</dd></div>
		</dl>`);
}

function renderIntensity(intensity) {
	const total = intensity?.totalSec || 0;
	if (!total) return card("Intensity mix", `<p class="tf-empty">No runs in the last four weeks.</p>`);
	const easy = finite(intensity.easyPct);
	const verdict = easy === null
		? "Not enough data to judge the balance."
		: easy >= 75
			? `${pct(easy)} easy — close enough to the 80% target.`
			: `${pct(easy)} easy, against an 80% target. Your easy days are running too hard.`;
	return card("Intensity mix", `<ul>
		<li>Easy ${t(pct(intensity.easyPct))} · ${t(formatDuration(intensity.easySec))}</li>
		<li>Moderate ${t(pct(intensity.moderatePct))} · ${t(formatDuration(intensity.moderateSec))}</li>
		<li>Hard ${t(pct(intensity.hardPct))} · ${t(formatDuration(intensity.hardSec))}</li>
	</ul><p>${t(verdict)}</p>`, `<span>last 4 weeks</span>`);
}

function renderPrediction(summary) {
	const prediction = summary?.prediction;
	const race = summary?.race || {};
	if (!prediction) {
		return card("Projected finish", `<p class="tf-empty">No hard effort of 5 km or longer yet to project from.</p>`);
	}
	const basis = prediction.basis;
	return card("Projected finish", `<p><strong>${t(clock(prediction.predictedSec))}</strong> ${t(signedClock(prediction.deltaSec))}</p>
		<dl class="tf-dl">
			<div><dt>Riegel</dt><dd>${t(clock(prediction.riegelSec))}</dd></div>
			<div><dt>VDOT</dt><dd>${t(clock(prediction.vdotSec))}${Number.isFinite(prediction.vdot) ? ` (${prediction.vdot.toFixed(1)})` : ""}</dd></div>
			<div><dt>Goal pace</dt><dd>${t(pace(race.goalPaceSecPerKm))}</dd></div>
		</dl>
		${basis ? `<p class="tf-note">Projected from your ${t(kmLabel(basis.distanceM))} best effort of ${t(clock(basis.timeSec))}${basis.date ? ` on ${t(shortDate(basis.date))}` : ""}.</p>` : ""}`);
}

function renderRecovery(recovery) {
	if (!recovery) return card("Recovery", `<p class="tf-empty">Nothing from the ring yet.</p>`);
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
	return card("Recovery", `<p><strong>${Number.isFinite(sleep.recent) ? t(formatDuration(sleep.recent)) : "—"}</strong> average night, last 7 · ${t(status)}</p>
		<dl class="tf-dl">
			<div><dt>Resting HR</dt><dd>${Number.isFinite(restingHr.recent) ? `${Math.round(restingHr.recent)} bpm` : "—"}</dd></div>
			<div><dt>HRV</dt><dd>${Number.isFinite(hrv.recent) ? `${Math.round(hrv.recent)} ms` : "—"}</dd></div>
		</dl>`);
}

function renderEfficiency(summary) {
	const change = finite(summary?.efficiency?.changePct);
	const longRun = summary?.longRun;
	if (change === null && !longRun) {
		return card("Aerobic efficiency", `<p class="tf-empty">Not enough aerobic runs to show a trend yet.</p>`);
	}
	return card("Aerobic efficiency", `<p>${change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`} over the block${longRun?.decouplingPct != null ? `. Last long run decoupling ${Number(longRun.decouplingPct).toFixed(1)}%.` : "."}</p>`);
}

function renderVolume(weeks, todayKey) {
	const rows = (weeks || []).filter((w) => !todayKey || w.start <= todayKey).slice(-12);
	if (rows.length === 0) return card("Weekly volume", `<p class="tf-empty">No weeks logged yet.</p>`);
	const body = rows.map((w) =>
		`<tr><th>${t(weekRange(w.start))}</th><td>${Number(w.actualKm || 0).toFixed(1)} km</td><td>${w.targetKm ? `${w.targetKm} km` : "—"}</td><td>${w.runs ?? "—"}</td></tr>`,
	).join("");
	return card("Weekly volume", `<table><thead><tr><th>Week</th><th>Actual</th><th>Target</th><th>Runs</th></tr></thead><tbody>${body}</tbody></table>`);
}

function renderRuns(runs, total) {
	const list = Array.isArray(runs) ? runs : [];
	if (list.length === 0) return card("Recent activity", `<p class="tf-empty">Nothing synced yet.</p>`);
	const runCount = list.filter((r) => r.sport !== "ride").length;
	const rideCount = list.length - runCount;
	const plannedCount = list.filter((r) => r.plan?.planned).length;
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
		return `<tr>
			<td>${t(shortDate(run.startDateLocal))}</td>
			<td>${name}</td>
			<td>${kind}${tag ? ` · ${t(tag)}` : ""}</td>
			<td>${t(formatDistance(run.distanceM))}</td>
			<td>${measure}</td>
		</tr>`;
	}).join("");
	const aside = `${Number.isFinite(total) && total > runCount ? `latest ${runCount} of ${total}` : `${runCount} runs`} · ${plannedCount} planned${rideCount ? ` · ${rideCount} ${rideCount === 1 ? "ride" : "rides"}` : ""}`;
	return card("Recent activity", `<table><thead><tr><th>Date</th><th>Name</th><th></th><th>Distance</th><th></th></tr></thead><tbody>${rows}</tbody></table>`, `<span>${t(aside)}</span>`);
}

function renderFooter(sync) {
	const stamp = sync?.lastRunAt
		? `<p class="tf-stamp">Last synced ${t(new Date(sync.lastRunAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}</p>`
		: "";
	return `<footer class="tf-foot">
		<p>Synced from Strava. Metrics are computed deterministically — training load from heart-rate reserve, pace adjusted for gradient, and every recommendation shows the number that triggered it. No route maps here by design.</p>
		<p><a href="${STRAVA_PROFILE}" rel="noreferrer">Strava profile ↗</a></p>
		${stamp}
	</footer>`;
}

function card(title, body, aside = "") {
	return `<section class="tf-card">
		<div class="tf-card-head">
			<h2>${t(title)}</h2>
			${aside}
		</div>
		${body}
	</section>`;
}
