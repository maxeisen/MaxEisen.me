// Where to break an ordered list of panels into two columns.
//
// The dashboard's two columns are independent, so a heavy one simply runs on
// past the other and leaves a few hundred pixels of nothing beside it. The
// split used to be a constant — the first five panels left, the next five
// right — which meant it was correct only until a panel was added, resized, or
// dragged somewhere else, and every one of those happened.
//
// So the order stays authored (it carries meaning: how the training is going,
// then what to do about it) and only the boundary is computed. Nothing is
// reordered to fit, which is the difference between this and a masonry layout:
// masonry would scatter the panels by height and lose the argument the order
// is making.
//
// Heights are measured from the rendered page rather than declared per panel,
// because a declared weight is a guess that goes stale the moment a panel says
// something longer than it used to.

/**
 * Total height of a column, including the gaps between its panels.
 *
 * @param {number[]} heights
 * @param {number} gap
 * @returns {number}
 */
export function columnHeight(heights, gap = 0) {
	if (!heights?.length) return 0;
	return heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
}

/**
 * How far apart the two columns would be if the list were split here.
 *
 * @param {number[]} heights in layout order.
 * @param {number} at index of the first panel in the second column.
 * @param {number} [gap]
 * @returns {number} pixels.
 */
export function imbalanceAt(heights, at, gap = 0) {
	return Math.abs(
		columnHeight(heights.slice(0, at), gap) - columnHeight(heights.slice(at), gap),
	);
}

/**
 * The split that leaves the two columns closest in height.
 *
 * @param {number[]} heights in layout order.
 * @param {object} [options]
 * @param {number} [options.gap] vertical gap between panels, in px.
 * @param {number} [options.min] fewest panels either column may hold. Two,
 *   by default: a lone panel beside a stack of nine balances the pixels and
 *   reads as a mistake.
 * @returns {number} index of the first panel in the second column.
 */
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
		// Strictly better, so the earliest of several equal splits wins and
		// the result doesn't depend on which direction the loop ran.
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
 * A panel changes height when it changes column — the columns are different
 * widths, so text rewraps — which means the measurement that suggested a move
 * is invalidated by the move itself. Two splits can therefore each look better
 * than the other once applied, and a naive loop will sit there swapping a
 * panel back and forth for ever.
 *
 * Requiring a real improvement is what settles it: the second move never
 * clears the bar, so the layout stops after the first.
 *
 * @param {number[]} heights
 * @param {number} from current split.
 * @param {number} to proposed split.
 * @param {object} [options]
 * @param {number} [options.gap]
 * @param {number} [options.minGain] pixels of improvement to justify a move.
 * @returns {boolean}
 */
export function worthMoving(heights, from, to, { gap = 0, minGain = 64 } = {}) {
	if (!Number.isFinite(to) || to === from) return false;
	return imbalanceAt(heights, from, gap) - imbalanceAt(heights, to, gap) > minGain;
}
