// Masonry column packing. Pure + exported so it can be unit-tested apart from
// the MasonryGrid component.
//
// Packs photos left-to-right into N columns, each next photo going to the
// currently-shortest column ("Pinterest" packing). Column widths are equal,
// so a photo's relative height is just its aspect ratio (height/width); a
// photo with no dimensions counts as a square (1). Result: the top row reads
// 1,2,3,4 in order (intuitive chronological flow) while staying gap-free.
//
// Returns an array of `columnCount` arrays of { p, originalIdx }, where
// originalIdx is the photo's index in the input (used for lightbox nav).

export function packColumns(photos, columnCount) {
	const n = Math.max(1, columnCount | 0);
	const cols = Array.from({ length: n }, () => []);
	const heights = new Array(n).fill(0);
	photos.forEach((p, originalIdx) => {
		let c = 0;
		for (let k = 1; k < n; k++) if (heights[k] < heights[c]) c = k;
		cols[c].push({ p, originalIdx });
		heights[c] += p.width && p.height ? p.height / p.width : 1;
	});
	return cols;
}
