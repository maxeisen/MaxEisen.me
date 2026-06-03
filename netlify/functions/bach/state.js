// GET /.netlify/functions/bach/state?code=&playerId=

import {
	passwordOk, jsonResponse, getSessionStore,
	validCode, readMeta, keys, listJSON, subId, storyAudioExists, readStoryImageBytes,
	readNarrationStatus, readImagesStatus,
} from "./_lib.js";

export default async function handler(req) {
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const url = new URL(req.url);
	const code = (url.searchParams.get("code") || "").toUpperCase();
	const playerId = url.searchParams.get("playerId") || "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);

	const round = meta.roundIndex;
	const assignments = meta.assignments || {};

	const playerBlobs = await listJSON(store, keys.playerPrefix(code));
	const playerList = playerBlobs
		.map((b) => b.value)
		.sort((a, b) => (a.joinedAt || "").localeCompare(b.joinedAt || ""));

	let subs = [];
	if (round >= 0) {
		const subBlobs = await listJSON(store, keys.subPrefix(code, round));
		subs = subBlobs.map((b) => b.value);
	}
	const submittedByPlayer = new Map();
	for (const s of subs) {
		if (!submittedByPlayer.has(s.playerId)) submittedByPlayer.set(s.playerId, new Set());
		submittedByPlayer.get(s.playerId).add(s.slotId);
	}

	const nameOf = (id) => playerList.find((p) => p.id === id)?.name || "Someone";

	const playerDone = (id) => {
		const assigned = assignments[id] || [];
		if (assigned.length === 0) return false;
		const got = submittedByPlayer.get(id) || new Set();
		return assigned.every((slot) => got.has(slot.slotId));
	};

	const players = playerList.map((p) => ({
		id: p.id,
		name: p.name,
		submitted: meta.phase === "writing" ? playerDone(p.id) : false,
	}));

	const assignedPlayerIds = Object.keys(assignments).filter((id) => (assignments[id] || []).length > 0);
	const counts = {
		submitted: assignedPlayerIds.filter(playerDone).length,
		total: assignedPlayerIds.length,
		answers: subs.filter((s) => s.value).length,
	};

	const state = {
		code,
		phase: meta.phase,
		roundIndex: round,
		version: meta.version,
		error: meta.error || null,
		players,
		counts,
		facts: meta.facts || "",
	};

	if (playerId && assignments[playerId]) {
		const got = subs.filter((s) => s.playerId === playerId);
		state.you = {
			assigned: true,
			slots: (assignments[playerId] || []).map((slot) => ({
				slotId: slot.slotId,
				prompt: slot.prompt,
				swapped: Boolean(slot.swapped),
				value: got.find((s) => s.slotId === slot.slotId)?.value || "",
			})),
		};
	} else if (playerId) {
		state.you = { assigned: false, slots: [] };
	}

	if (["reveal", "voting", "results", "finished"].includes(meta.phase) && round >= 0) {
		state.story = (await store.get(keys.story(code, round), { type: "text" })) || "";
		const audioReady = await storyAudioExists(store, code, round);
		state.storyAudioReady = audioReady;
		const nStatus = (await readNarrationStatus(store, code, round))
			?? { pending: meta.narrationPending, error: meta.narrationError };
		state.narrationPending = Boolean(nStatus.pending);
		state.narrationError = nStatus.error || null;

		const iStatus = (await readImagesStatus(store, code, round))
			?? { pending: meta.imagesPending, error: meta.imagesError, placements: meta.storyImagePlacements };
		const placements = Array.isArray(iStatus.placements) ? iStatus.placements : [];
		state.storyImagePlacements = placements;
		state.imagesPending = Boolean(iStatus.pending);
		state.imagesError = iStatus.error || null;

		const readyImageIds = [];
		for (const slot of placements) {
			const id = Number(slot.id);
			if (!Number.isInteger(id) || id < 0) continue;
			const bytes = await readStoryImageBytes(store, code, round, id);
			if (bytes?.length) readyImageIds.push(id);
		}
		state.readyImageIds = readyImageIds;
		state.storyImagesReady = readyImageIds.length;
		state.hasStoryImages = readyImageIds.length > 0;
		// Do not clear meta.hasStoryAudio here — a transient blob read would drop
		// storyAudioReady and unmount the host <audio> while narration is playing.
	}

	if (["voting", "results"].includes(meta.phase) && round >= 0) {
		state.ballot = subs.map((s) => ({
			id: subId(s.playerId, s.slotId),
			prompt: s.prompt,
			value: s.value,
			authorId: s.playerId,
			authorName: nameOf(s.playerId),
		}));
		if (playerId) {
			const vote = await store.get(keys.vote(code, round, playerId), { type: "json" });
			state.you = { ...(state.you || {}), hasVoted: Boolean(vote), votedFor: vote?.targetSubId || null };
		}
		const voteBlobs = await listJSON(store, keys.votePrefix(code, round));
		state.voteCount = voteBlobs.length;
	}

	const lb = meta.leaderboard || {};
	state.leaderboard = Object.keys(lb)
		.map((id) => ({ playerId: id, name: nameOf(id), points: lb[id] }))
		.sort((a, b) => b.points - a.points);
	if (meta.phase === "results") state.mvp = meta.lastMvp || null;

	return jsonResponse(state);
}
