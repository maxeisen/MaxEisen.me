// Shared id for the JSON payload trainingPage embeds in /training.
// Kept here so the SPA and the HTML injector agree without the client
// importing the noscript renderer.

export const TRAINING_BOOTSTRAP_ID = "training-bootstrap";

/**
 * JSON that is safe to put inside a <script type="application/json"> tag.
 * JSON.stringify does not escape `<`, so a value containing `</script>`
 * would close the tag and execute whatever followed.
 *
 * @param {any} payload
 * @returns {string}
 */
export function embedJson(payload) {
	return JSON.stringify(payload ?? null).replace(/</g, "\\u003c");
}

/**
 * Read the payload trainingPage left in the document, or null.
 *
 * @returns {object|null}
 */
export function readTrainingBootstrap() {
	if (typeof document === "undefined") return null;
	const el = document.getElementById(TRAINING_BOOTSTRAP_ID);
	if (!el?.textContent) return null;
	try {
		return JSON.parse(el.textContent);
	} catch {
		return null;
	}
}
