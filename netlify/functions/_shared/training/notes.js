// What the athlete wrote about a run, for the part of it written to be read.
//
// Everything else on this page is measured. This is the one field where the
// runner gets to say why — why the long run was ten kilometres instead of
// twenty, why a Tuesday was jogged rather than run. No amount of heart rate
// data recovers that, and a training log without it invites the chart to
// imply things about a week that had a wedding in it.
//
// The parsing is deliberately an allowlist rather than a sanitiser, because a
// Strava description is free text and this page is public. A line has to open
// with a key named here before any of it is published, so the rest of the
// description — which is most of it, and which was written for a completely
// different audience — never leaves the sync. Writing a note is then a
// deliberate act rather than something that happens to whatever you last
// typed into Strava.
//
//   excuse: wedding in the evening, cut the long run to 10k
//   note: new shoes, first run in them
//
// Anything else in the description is ignored, including a bare sentence: a
// key with no match is a note that doesn't appear, which is a better failure
// than a note that appears and shouldn't have.

// Long enough for a sentence or two of explanation, short enough that a
// pasted paragraph can't push a run log off the page. Truncation is at a word
// boundary and marked, so a clipped note reads as clipped.
export const MAX_NOTE_CHARS = 240;

// More than a couple of these on one run is a description being used as a
// notebook, and the page has room for two lines.
const MAX_NOTES = 3;

const TAGGED = /^\s*(excuse|note)\s*:\s*(.+)$/i;

function clamp(text) {
	if (text.length <= MAX_NOTE_CHARS) return text;
	const cut = text.slice(0, MAX_NOTE_CHARS);
	const space = cut.lastIndexOf(" ");
	const kept = space > MAX_NOTE_CHARS * 0.6 ? cut.slice(0, space) : cut;
	return `${kept.trimEnd()}…`;
}

/**
 * The tagged lines of a Strava description, in the order they were written.
 *
 * @param {string} description the activity's description, as Strava has it.
 * @returns {{kind: "excuse"|"note", text: string}[]} empty for a description
 *   with no tagged lines, which is the ordinary case.
 */
export function shapeNotes(description) {
	if (typeof description !== "string" || description === "") return [];

	const notes = [];
	for (const line of description.split(/\r?\n/)) {
		const match = TAGGED.exec(line);
		if (!match) continue;
		// Newlines are already gone; this is for the tabs and double spaces
		// that survive a phone keyboard.
		const text = match[2].replace(/\s+/g, " ").trim();
		if (text === "") continue;
		notes.push({ kind: match[1].toLowerCase(), text: clamp(text) });
		if (notes.length >= MAX_NOTES) break;
	}
	return notes;
}
