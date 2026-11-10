// A rearrangeable grid: the drag mechanics, plus the edit mode that decides
// when they're allowed.
//
// Dragging is free while the layout is wide enough to be pointer-driven, and
// gated behind a toggle once it goes responsive — where a press-and-drag is
// otherwise how you scroll the page. The toggle only exists in that narrow
// state, which is why widening the window turns editing back off.
//
// This lived inline in Dashboard.svelte until /running wanted the same
// behaviour. It's here so there's one of it: the same rule for when dragging
// is allowed, and the same rule for which clicks are drag residue.

/* global $state -- a compiler intrinsic, not an import, and the analyser on
   pull requests reads this file without knowing that. */

import { createReorder } from "./reorder.svelte.js";

/**
 * @param {object} options
 * @param {string} options.gridId id of the grid element; clicks are only
 *   suppressed inside it.
 * @param {string} [options.responsiveQuery] media query for "the layout has
 *   collapsed", i.e. where dragging has to be asked for first.
 * @param {boolean} [options.editableWhenWide] the page offers edit mode at
 *   every width (the dashboard, where it's also how widgets are shown and
 *   hidden), so leaving the collapsed state shouldn't end it.
 * @param {Function} [options.createDrag] the drag mechanics; defaults to
 *   createReorder (fixed slots that swap). The dashboard passes its own,
 *   with the same `enabled` option and `suppressesClick()`.
 * @param {...*} options.rest everything else goes to createDrag.
 * @returns {{reorder: object, edit: object}}
 */
export function createRearrangeable({
	gridId,
	responsiveQuery = "(max-width: 1100px)",
	editableWhenWide = false,
	createDrag = createReorder,
	...reorderOptions
}) {
	let isEditing = $state(false);
	let isResponsive = $state(false);

	const reorder = createDrag({
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
			// (unless the page keeps it) leaves no button to turn edit mode
			// off with.
			if (!event.matches && !editableWhenWide) {
				isEditing = false;
			}
		};
		query.addEventListener("change", onQueryChange);

		// Capture phase, so this beats anchor navigation: a click inside the
		// grid is swallowed for a moment after a drag, and at all times while
		// editing — matching iOS jiggle mode, where tapping an icon doesn't
		// open it. Controls that only exist in edit mode (a tile's hide
		// button) opt out with data-edit-control.
		onClickCapture = (event) => {
			if (!event.target.closest(`#${gridId}`) || event.target.closest("[data-edit-control]")) {
				return;
			}
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
