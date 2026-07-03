// Ref-counted body scroll lock with scrollbar-width compensation.
//
// Setting overflow:hidden alone removes the scrollbar on classic scrollbar
// systems (~15px), which makes the page jump horizontally when a modal
// opens/closes. Measure the gutter once and pad body by that amount while
// locked; on macOS overlay scrollbars the width is 0 so nothing changes.

let lockCount = 0;
let previousOverflow = "";
let previousPaddingRight = "";

function scrollbarWidth() {
	return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

export function lockBodyScroll() {
	if (typeof document === "undefined") return;
	lockCount++;
	if (lockCount > 1) return;

	previousOverflow = document.body.style.overflow;
	previousPaddingRight = document.body.style.paddingRight;

	const gutter = scrollbarWidth();
	document.body.style.overflow = "hidden";
	if (gutter > 0) {
		document.body.style.paddingRight = `${gutter}px`;
	}
}

export function unlockBodyScroll() {
	if (typeof document === "undefined") return;
	lockCount = Math.max(0, lockCount - 1);
	if (lockCount > 0) return;

	document.body.style.overflow = previousOverflow;
	document.body.style.paddingRight = previousPaddingRight;
}

/** Test helper — reset module state between unit tests. */
export function resetBodyScrollLockForTests() {
	lockCount = 0;
	previousOverflow = "";
	previousPaddingRight = "";
}
