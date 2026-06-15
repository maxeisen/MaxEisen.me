// GET /.netlify/functions/bach-story-audio?code=&round=

import { loadBachBinary, binaryError, binaryResponse, readStoryAudioBytes } from "./_lib.js";

export default async function handler(req) {
	const gate = await loadBachBinary(req);
	if (gate.response) return gate.response;
	const { store, code, round } = gate;

	const bytes = await readStoryAudioBytes(store, code, round);
	if (!bytes?.length) return binaryError("not_found", 404);

	return binaryResponse(bytes, "audio/mpeg");
}
