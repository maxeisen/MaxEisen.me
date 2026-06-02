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
	return { ok: res.ok, status: res.status, data };
}

export async function checkPassword(password) {
	return post("bach-check-password", password, { password });
}

export async function createSession(password, facts) {
	return post("bach-create", password, { facts });
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

export async function castVote(password, { code, playerId, targetSubId }) {
	return post("bach-vote", password, { code, playerId, targetSubId });
}

export async function hostAction(password, payload) {
	return post("bach-host", password, payload);
}

export async function generateStory(password, { code, hostToken }) {
	return post("bach-story", password, { code, hostToken });
}
