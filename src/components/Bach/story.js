// Turns the raw model output into a safe { title, paragraphs[] } structure.
// Escapes HTML; any stray **markers** from the model become <strong> (legacy).

function escapeHtml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function boldify(s) {
	return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function formatStory(text) {
	if (!text) return { title: "", paragraphs: [] };
	const lines = text.split("\n").map((l) => l.trim());

	let title = "";
	const rest = [];
	for (const line of lines) {
		if (!title && line) { title = line.replace(/^#+\s*/, "").replace(/\*\*/g, ""); continue; }
		rest.push(line);
	}

	const paragraphs = rest
		.join("\n")
		.split(/\n+/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map(boldify);

	return { title, paragraphs };
}

/**
 * Interleave paragraph HTML and images after the matching paragraph index.
 * @param {string[]} paragraphs
 * @param {{ id: number, insertAfter: number, caption?: string }[]} placements
 * @param {Record<number, string>} imageUrls blob URLs keyed by placement id
 */
export function buildStoryBlocks(paragraphs, placements, imageUrls) {
	const blocks = [];
	const byAfter = new Map();
	for (const p of placements || []) {
		const list = byAfter.get(p.insertAfter) || [];
		list.push(p);
		byAfter.set(p.insertAfter, list);
	}

	for (let i = 0; i < paragraphs.length; i++) {
		blocks.push({ type: "paragraph", html: paragraphs[i], index: i });
		for (const slot of byAfter.get(i) || []) {
			blocks.push({
				type: "image",
				id: slot.id,
				url: imageUrls[slot.id] || null,
				caption: slot.caption || "",
			});
		}
	}
	return blocks;
}
