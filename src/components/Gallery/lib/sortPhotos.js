// Ordering applied to the photo list client-side after fetch. Pure + exported
// so it can be unit-tested independently of the Gallery component.
//
// Modes:
//   "date-desc"    — newest upload first (created_at, descending)
//   "captured-asc" — chronological by capture time (EXIF/IPTC), oldest first;
//                    ties break by natural filename so batch-scanned frames
//                    sharing one timestamp keep roll order
//   "filename-asc" — natural (numeric-aware) order by original filename
//   "random"       — Fisher–Yates shuffle (rng injectable for tests)

const naturalName = (p) => p.display_name || p.public_id || "";
const captureKey = (p) => p.captured_at || p.created_at || "";
const NATURAL = { numeric: true, sensitivity: "base" };

export function sortPhotos(arr, sort, random = Math.random) {
	const next = [...arr];
	if (sort === "date-desc") {
		next.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
	} else if (sort === "captured-asc") {
		next.sort(
			(a, b) =>
				captureKey(a).localeCompare(captureKey(b)) ||
				naturalName(a).localeCompare(naturalName(b), undefined, NATURAL),
		);
	} else if (sort === "filename-asc") {
		next.sort((a, b) => naturalName(a).localeCompare(naturalName(b), undefined, NATURAL));
	} else if (sort === "random") {
		for (let i = next.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[next[i], next[j]] = [next[j], next[i]];
		}
	}
	return next;
}
