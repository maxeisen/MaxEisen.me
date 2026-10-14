// Whether /training is a race build or a running log, and the title that follows.
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
