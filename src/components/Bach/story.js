// Turns the raw model output into a safe { title, paragraphs[] } structure.
// The model wraps each guest-supplied word in **double asterisks**; we escape
// the text first (defense-in-depth, even though the source is our own API)
// then convert those markers into highlighted <strong> spans.

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
