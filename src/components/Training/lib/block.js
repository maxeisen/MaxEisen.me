// Whether /running is a race build or a running log, and the title that follows.
//
// The engine decides (raceAhead in plan.js) and stamps `summary.inBlock`.
// This reads that stamp. A countdown still counts when an older payload
// hasn't grown the flag yet, which is the same answer.

/**
 * @param {object} [summary] dashboard summary.
 * @returns {boolean}
 */
export function inBlock(summary) {
	if (typeof summary?.inBlock === "boolean") return summary.inBlock;
	const days = summary?.daysToRace;
	return Number.isFinite(days) && days >= 0;
}

/**
 * "Bank of America Chicago Marathon · 11 October 2026" once that race is
 * behind you, for the header between blocks. Null during a block, or when
 * the plan never named a race.
 *
 * @param {object} [summary]
 * @returns {string|null}
 */
export function lastRaceLine(summary) {
	const race = lastRace(summary);
	return race ? [race.name, race.dateLabel].filter(Boolean).join(" · ") : null;
}

/**
 * The race behind you, once race day has passed: what it was, when, and the
 * finish if one has been entered. Null during a block or with no named race.
 *
 * @param {object} [summary]
 * @returns {{name: string, date: string|null, dateLabel: string,
 *   distanceM: number, isMarathon: boolean, resultSec: number|null,
 *   goalDeltaSec: number|null}|null} goalDeltaSec is negative when the
 *   finish beat the goal.
 */
export function lastRace(summary) {
	if (inBlock(summary)) return null;
	const race = summary?.race;
	const days = summary?.daysToRace;
	if (!race?.name || !Number.isFinite(days) || days >= 0) return null;
	const date = race.date ? new Date(`${race.date}T12:00:00Z`) : null;
	const dateLabel = date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
		: "";
	const distanceM = Number(race.distanceM) || 42195;
	const resultSec = Number(race.resultSec) > 0 ? Number(race.resultSec) : null;
	const goalSec = Number(race.goalTimeSec) > 0 ? Number(race.goalTimeSec) : null;
	return {
		name: race.name,
		date: race.date || null,
		dateLabel,
		distanceM,
		isMarathon: Math.abs(distanceM - 42195) < 200,
		resultSec,
		goalDeltaSec: resultSec && goalSec ? resultSec - goalSec : null,
	};
}

/**
 * Document title and social card. A block keeps the race's short label —
 * the page heading still uses the full name — and everything else is just running.
 *
 * @param {object} [summary]
 * @returns {{title: string, desc: string, card: string}}
 */
export function trainingPageMeta(summary) {
	if (inBlock(summary) && summary?.race?.name) {
		const label = summary.race.label || summary.race.name;
		return {
			title: `${label} — Max Eisen`,
			desc: "Live marathon training dashboard: weekly volume, fitness and fatigue, intensity balance, and where I'm projected to finish.",
			card: label,
		};
	}
	return {
		title: "Running — Max Eisen",
		desc: "Running dashboard: weekly volume, fitness and fatigue, recovery, and how the training is landing.",
		card: "Running",
	};
}
