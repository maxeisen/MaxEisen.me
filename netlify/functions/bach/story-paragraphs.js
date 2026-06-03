/** Split raw story text into title + paragraph strings (matches client formatStory). */

export function splitStoryParagraphs(raw) {
	if (!raw) return { title: "", paragraphs: [] };
	const lines = raw.split("\n").map((l) => l.trim());
	let title = "";
	const rest = [];
	for (const line of lines) {
		if (!title && line) {
			title = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
			continue;
		}
		rest.push(line);
	}
	const paragraphs = rest
		.join("\n")
		.split(/\n+/)
		.map((p) => p.trim())
		.filter(Boolean);
	return { title, paragraphs };
}
