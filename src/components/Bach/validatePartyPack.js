export const MAX_PARTY_PACK_BYTES = 2 * 1024 * 1024;

/** @returns {string|null} error message */
export function validatePartyPack(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return "Root must be a JSON object.";
	}
	const json = JSON.stringify(raw);
	if (json.length > MAX_PARTY_PACK_BYTES) {
		return `Party pack too large (${Math.round(json.length / 1024)}KB; max ${MAX_PARTY_PACK_BYTES / 1024}KB).`;
	}
	if (!Array.isArray(raw.pools) || raw.pools.length === 0) {
		return "Include at least one pool with prompts.";
	}
	for (const pool of raw.pools) {
		if (!pool || typeof pool !== "object") return "Each pool must be an object.";
		if (!Array.isArray(pool.prompts) || pool.prompts.length === 0) {
			return `Pool "${pool.id || pool.label || "?"}" needs a prompts array.`;
		}
	}
	return null;
}
