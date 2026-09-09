// Where to break an ordered list of panels into two columns.
//
// The order stays authored; only the boundary is computed. Heights are
// measured from the page because a declared weight goes stale the moment a
// panel says something longer than it used to.

export const MIN_GAIN_PX = 64;

export function columnHeight(heights, gap = 0) {
	if (!heights?.length) return 0;
	return heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
}

export function imbalanceAt(heights, at, gap = 0) {
	return Math.abs(
		columnHeight(heights.slice(0, at), gap) - columnHeight(heights.slice(at), gap),
	);
}

/** Split that leaves the two columns closest in height. min=2 so a lone panel beside a stack of nine is never "balanced". */
export function bestSplit(heights, { gap = 0, min = 2 } = {}) {
	const list = (heights || []).filter((h) => Number.isFinite(h));
	if (list.length !== (heights || []).length) return null;

	const lowest = Math.max(1, min);
	const highest = list.length - lowest;
	if (highest < lowest) return null;

	let best = lowest;
	let bestGap = Infinity;
	for (let at = lowest; at <= highest; at++) {
		const gapHere = imbalanceAt(list, at, gap);
		if (gapHere < bestGap) {
			bestGap = gapHere;
			best = at;
		}
	}
	return best;
}

/**
 * Whether a proposed split is worth moving to.
 *
 * A panel changes height when it changes column, so the measurement that
 * suggested a move is invalidated by the move itself. Requiring a real
 * improvement settles it: the second move never clears the bar.
 */
export function worthMoving(heights, from, to, { gap = 0, minGain = MIN_GAIN_PX } = {}) {
	if (!Number.isFinite(to) || to === from) return false;
	return imbalanceAt(heights, from, gap) - imbalanceAt(heights, to, gap) > minGain;
}
