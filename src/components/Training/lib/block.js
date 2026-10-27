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
	if (inBlock(summary)) return null;
	const race = summary?.race;
	const days = summary?.daysToRace;
	if (!race?.name || !Number.isFinite(days) || days >= 0) return null;
	const date = race.date ? new Date(`${race.date}T12:00:00Z`) : null;
	const when = date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
		: "";
	return [race.name, when].filter(Boolean).join(" · ");
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
