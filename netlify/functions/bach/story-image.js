// GET /.netlify/functions/bach-story-image?code=&round=&id=

import { loadBachBinary, binaryError, binaryResponse, readStoryImageBytes } from "./_lib.js";

export default async function handler(req) {
	const gate = await loadBachBinary(req, { withId: true });
	if (gate.response) return gate.response;
	const { store, code, round, id } = gate;

	const bytes = await readStoryImageBytes(store, code, round, id);
	if (!bytes?.length) return binaryError("not_found", 404);

	return binaryResponse(bytes, "image/png");
}
