#!/usr/bin/env node
/** End-to-end bach story + audio smoke test against netlify dev (port 8888). */
import { readFileSync } from "node:fs";

const BASE = process.env.BACH_BASE || "http://localhost:8888";
const FN = `${BASE}/.netlify/functions`;
const PW = process.env.BACH_PASSWORD;
if (!PW) {
	console.error("Set BACH_PASSWORD (e.g. node --env-file=.env scripts/bach-audio-smoke.mjs)");
	process.exit(1);
}

const headers = (extra = {}) => ({
	"Content-Type": "application/json",
	"X-Bach-Password": PW,
	...extra,
});

async function post(name, body) {
	const t0 = Date.now();
	const res = await fetch(`${FN}/${name}`, {
		method: "POST",
		headers: headers(),
		body: JSON.stringify(body),
	});
	const text = await res.text();
	let data = null;
	try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
	return { ok: res.ok, status: res.status, ms: Date.now() - t0, data };
}

async function get(name, qs = "") {
	const t0 = Date.now();
	const res = await fetch(`${FN}/${name}?${qs}`, { headers: headers() });
	const ms = Date.now() - t0;
	return { res, ms };
}

function log(step, r) {
	console.log(`[${step}] ${r.status} ${r.ms}ms`, typeof r.data === "object" ? JSON.stringify(r.data).slice(0, 120) : r.data);
}

const create = await post("bach-create", {
	facts: "Smoke test couple.",
	groom: "Alex",
	partner: "Sam",
	storyTone: "short and silly",
	partyId: "default",
});
log("create", create);
if (!create.ok) process.exit(1);
const { code, hostToken } = create.data;

const join = await post("bach-join", { code, name: "Tester" });
log("join", join);
const playerId = join.data?.playerId;

const start = await post("bach-host", {
	code,
	hostToken,
	action: "start",
	prompts: ["a colour", "a snack", "a place"],
	slotsPerPlayer: 1,
});
log("start", start);

await post("bach-submit", {
	code,
	playerId,
	slotId: "s0",
	value: "chartreuse",
});

console.log("\n--- bach-story (text) ---");
const story = await post("bach-story", { code, hostToken });
log("story", story);
if (!story.ok) process.exit(1);

console.log("\n--- bach-story-tts ---");
const tts = await post("bach-story-tts-background", { code, hostToken });
log("story-tts-background", tts);
if (!tts.ok && tts.status !== 202) process.exit(1);

for (let i = 0; i < 40; i++) {
	const stateRes = await get("bach-state", new URLSearchParams({ code }));
	const stateJson = await stateRes.res.json();
	if (stateJson.storyAudioReady) break;
	if (!stateJson.narrationPending && i > 2) {
		console.error("Narration stopped without audio:", stateJson.narrationError);
		process.exit(1);
	}
	await new Promise((r) => setTimeout(r, 1500));
}

const stateRes = await get("bach-state", new URLSearchParams({ code }));
const stateJson = await stateRes.res.json();
console.log("[state]", stateRes.ms + "ms", {
	phase: stateJson.phase,
	storyAudioReady: stateJson.storyAudioReady,
	narrationPending: stateJson.narrationPending,
	storyLen: stateJson.story?.length,
});
if (!stateJson.storyAudioReady) {
	console.error("Timed out waiting for narration");
	process.exit(1);
}

console.log("\n--- bach-story-audio ---");
const audioRes = await get("bach-story-audio", new URLSearchParams({ code, round: "0" }));
console.log("[audio]", audioRes.res.status, audioRes.ms + "ms", "content-type:", audioRes.res.headers.get("content-type"));
const buf = await audioRes.res.arrayBuffer();
console.log("[audio] bytes:", buf.byteLength);
if (buf.byteLength < 100) {
	const errText = new TextDecoder().decode(buf);
	console.error("Unexpected audio response:", errText);
	process.exit(1);
}
console.log("\nOK — story and audio completed.");
