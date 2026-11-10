// How a day's training session reads: a title and a note, from the
// `session` the training payload carries for today. Shared by the /running
// "Today" card and the dashboard's Running widget, so both say the same
// thing about the same day.

/** The first run on the day's plan, if there is one. */
export function plannedRunOf(session) {
	return (session?.planned || []).find((s) => s.isRun) || null;
}

/**
 * Whether there's a session to talk about: something on the plan (a rest day
 * the plan asks for counts) or a run already recorded. Between blocks most
 * days have neither.
 */
export function hasSession(session) {
	return Boolean(session) && ((session.planned?.length ?? 0) > 0 || session.actualKm > 0 || session.runs > 0);
}

/**
 * @param {object|null} session
 * @param {{inBlock?: boolean}} [options] outside a block nothing is
 *   "unplanned", so an extra run gets no note.
 * @returns {{title: string, note: string}}
 */
export function sessionCopy(session, { inBlock = true } = {}) {
	if (!session) return { title: "—", note: "" };
	const plannedRun = plannedRunOf(session);
	if (session.status === "rest") {
		// Strength, or a rest day the plan wrote down — no kilometres either way.
		const entry = session.planned?.[0];
		const detail = entry?.detail && entry.detail.toLowerCase() !== String(entry.type || "").toLowerCase()
			? entry.detail
			: "";
		return { title: entry?.type || "Rest", note: detail || "no running planned" };
	}
	if (session.status === "ahead") {
		const kmLabel = Number.isFinite(plannedRun?.distanceKm) ? `${plannedRun.distanceKm} km` : "";
		return {
			title: plannedRun?.type || "Session",
			note: [kmLabel, plannedRun?.detail].filter(Boolean).join(" · ") || "still ahead",
		};
	}
	if (session.status === "done") {
		const actual = session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "done";
		const target = Number.isFinite(plannedRun?.distanceKm) ? `of ${plannedRun.distanceKm}` : "";
		return { title: actual, note: [target, plannedRun?.type].filter(Boolean).join(" · ") };
	}
	return {
		title: session.actualKm > 0 ? `${session.actualKm.toFixed(1)} km` : "Extra",
		note: inBlock ? "unplanned" : "",
	};
}
