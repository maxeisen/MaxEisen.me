// A rearrangeable grid: the drag mechanics, plus the edit mode that decides
// when they're allowed.
//
// Dragging is free while the layout is wide enough to be pointer-driven, and
// gated behind a toggle once it goes responsive — where a press-and-drag is
// otherwise how you scroll the page. The toggle only exists in that narrow
// state, which is why widening the window turns editing back off.
//
// This lived inline in Dashboard.svelte until /training wanted the same
// behaviour. It's here so there's one of it: the same rule for when dragging
// is allowed, and the same rule for which clicks are drag residue.

import { createReorder } from "./reorder.svelte.js";

/**
 * @param {object} options
 * @param {string} options.gridId id of the grid element; clicks are only
 *   suppressed inside it.
 * @param {string} [options.responsiveQuery] media query for "the layout has
 *   collapsed", i.e. where dragging has to be asked for first.
 * @param {...*} options.rest everything else goes to createReorder.
 * @returns {{reorder: object, edit: object}}
 */
export function createRearrangeable({
	gridId,
	responsiveQuery = "(max-width: 1100px)",
	...reorderOptions
}) {
	let isEditing = $state(false);
	let isResponsive = $state(false);

	const reorder = createReorder({
		...reorderOptions,
		enabled: () => !(isResponsive && !isEditing),
	});

	let query;
	let onQueryChange;
	let onClickCapture;

	function listen() {
		query = window.matchMedia(responsiveQuery);
		isResponsive = query.matches;
		onQueryChange = (event) => {
			isResponsive = event.matches;
			// Widening the window puts dragging back within reach anyway, and
			// leaves no button to turn edit mode off with.
			if (!event.matches) isEditing = false;
		};
		query.addEventListener("change", onQueryChange);

		// Capture phase, so this beats anchor navigation: a click inside the
		// grid is swallowed for a moment after a drag, and at all times while
		// editing — matching iOS jiggle mode, where tapping an icon doesn't
		// open it.
		onClickCapture = (event) => {
			if (!event.target.closest(`#${gridId}`)) return;
			if (reorder.suppressesClick() || isEditing) {
				event.preventDefault();
				event.stopPropagation();
			}
		};
		document.addEventListener("click", onClickCapture, true);
	}

	function stop() {
		query?.removeEventListener("change", onQueryChange);
		document.removeEventListener("click", onClickCapture, true);
	}

	return {
		reorder,
		edit: {
			get isEditing() { return isEditing; },
			get isResponsive() { return isResponsive; },

			/** stopPropagation: the button sits over the grid's click capture. */
			toggle(event) {
				event?.stopPropagation();
				isEditing = !isEditing;
			},

			listen,
			stop,
		},
	};
}
