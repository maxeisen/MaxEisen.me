// Client for /.netlify/functions/bach-* endpoints.
// Handlers live under netlify/functions/bach/; thin re-exports at the
// functions root are required because netlify-cli only registers top-level
// function files as endpoints.

const FN = "/.netlify/functions";

async function post(name, password, body) {
	const res = await fetch(`${FN}/${name}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Bach-Password": password || "",
		},
		body: JSON.stringify(body || {}),
	});
	let data = null;
	try { data = await res.json(); } catch { /* ignore */ }
	const accepted = res.status === 202;
	return { ok: res.ok || accepted, status: res.status, data, accepted };
}

export async function checkPassword(password) {
	return post("bach-check-password", password, { password: password?.trim?.() ?? password });
}

export async function createSession(password, payload) {
	return post("bach-create", password, payload);
}

export async function joinSession(password, { code, name, playerId }) {
	return post("bach-join", password, { code, name, playerId });
}

export async function fetchState(password, code, playerId) {
	const qs = new URLSearchParams({ code });
	if (playerId) qs.set("playerId", playerId);
	const res = await fetch(`${FN}/bach-state?${qs.toString()}`, {
		headers: { "X-Bach-Password": password || "" },
	});
	let data = null;
	try { data = await res.json(); } catch { /* ignore */ }
	return { ok: res.ok, status: res.status, data };
}

export async function submitWord(password, { code, playerId, slotId, value }) {
	return post("bach-submit", password, { code, playerId, slotId, value });
}

export async function swapPrompt(password, { code, playerId, slotId }) {
	return post("bach-swap-prompt", password, { code, playerId, slotId });
}

export async function castVote(password, { code, playerId, targetSubId }) {
	return post("bach-vote", password, { code, playerId, targetSubId });
}

export async function hostAction(password, payload) {
	return post("bach-host", password, payload);
}

export async function generateStory(password, { code, hostToken }) {
	return post("bach-story", password, { code, hostToken });
}

export async function generateStoryTts(password, { code, hostToken }) {
	return post("bach-story-tts-background", password, { code, hostToken });
}

export async function fetchPartyPack(password, packId, { library = false } = {}) {
	const qs = new URLSearchParams();
	if (packId) qs.set("pack", packId);
	if (library) qs.set("library", "1");
	const suffix = qs.toString() ? `?${qs.toString()}` : "";
	const res = await fetch(`${FN}/bach-party-pack${suffix}`, {
		headers: { "X-Bach-Password": password || "" },
	});
	let data = null;
	try { data = await res.json(); } catch { /* ignore */ }
	return { ok: res.ok, status: res.status, data };
}

/** Select a seeded library pack by id (clears custom JSON override). */
export async function selectPartyPack(password, packId) {
	return post("bach-party-pack", password, { packId });
}

export async function uploadPartyPack(password, party) {
	return post("bach-party-pack", password, { party });
}

export async function generateStoryVideo(password, { code, hostToken }) {
	return post("bach-story-video-background", password, { code, hostToken });
}

export async function fetchStoryVideo(password, code, roundIndex, { timeoutMs = 120_000 } = {}) {
	const qs = new URLSearchParams({ code, round: String(roundIndex) });
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(`${FN}/bach-story-video?${qs.toString()}`, {
			headers: { "X-Bach-Password": password || "" },
			signal: ctrl.signal,
		});
		if (!res.ok) return { ok: false, status: res.status };
		const blob = await res.blob();
		return { ok: true, blob };
	} catch (err) {
		if (err?.name === "AbortError") return { ok: false, status: 408, timedOut: true };
		throw err;
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchStoryAudio(password, code, roundIndex, { timeoutMs = 60_000 } = {}) {
	const qs = new URLSearchParams({ code, round: String(roundIndex) });
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(`${FN}/bach-story-audio?${qs.toString()}`, {
			headers: { "X-Bach-Password": password || "" },
			signal: ctrl.signal,
		});
		if (!res.ok) return { ok: false, status: res.status };
		const blob = await res.blob();
		return { ok: true, blob };
	} catch (err) {
		if (err?.name === "AbortError") return { ok: false, status: 408, timedOut: true };
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
