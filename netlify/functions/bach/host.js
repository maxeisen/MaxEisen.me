// POST /.netlify/functions/bach/host

import {
	passwordOk, jsonResponse, readBody, getSessionStore,
	validCode, readMeta, writeMeta, keys, listJSON, deletePrefix,
	shuffle, subId,
} from "./_lib.js";

export default async function handler(req) {
	if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
	if (!passwordOk(req)) return jsonResponse({ error: "unauthorized" }, 401);

	const body = await readBody(req);
	if (body === null) return jsonResponse({ error: "Invalid JSON body" }, 400);

	const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
	if (!validCode(code)) return jsonResponse({ error: "invalid_code" }, 400);

	const store = getSessionStore();
	const meta = await readMeta(store, code);
	if (!meta) return jsonResponse({ error: "no_such_session" }, 404);

	const hostToken = typeof body?.hostToken === "string" ? body.hostToken : "";
	if (hostToken !== meta.hostToken) return jsonResponse({ error: "not_host" }, 403);

	const action = typeof body?.action === "string" ? body.action : "";

	switch (action) {
		case "start": {
			const prompts = Array.isArray(body?.prompts)
				? body.prompts.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim())
				: [];
			const swapPoolRaw = Array.isArray(body?.swapPool) ? body.swapPool : prompts;
			const swapPool = [...new Set(
				swapPoolRaw
					.filter((p) => typeof p === "string" && p.trim())
					.map((p) => p.trim()),
			)];
			const slotsPerPlayer = Math.max(1, Math.min(6, Number(body?.slotsPerPlayer) || 3));
			if (prompts.length === 0) return jsonResponse({ error: "no_prompts" }, 400);

			const round = meta.roundIndex + 1;
			await Promise.all([
				deletePrefix(store, keys.subPrefix(code, round)),
				deletePrefix(store, keys.votePrefix(code, round)),
				store.delete(keys.story(code, round)),
				store.delete(keys.storyAudio(code, round)),
				store.delete(keys.storyImagesManifest(code, round)),
				deletePrefix(store, keys.storyImagePrefix(code, round)),
				store.delete(keys.narrationStatus(code, round)),
				store.delete(keys.imagesStatus(code, round)),
			]);

			const playerBlobs = await listJSON(store, keys.playerPrefix(code));
			const pool = shuffle(prompts);
			const assignments = {};
			let pi = 0;
			for (const { value: player } of playerBlobs) {
				const slots = [];
				for (let k = 0; k < slotsPerPlayer; k++) {
					const prompt = pool[pi] ?? pool[pi % pool.length];
					slots.push({ slotId: `s${k}`, prompt, swapped: false });
					pi++;
				}
				assignments[player.id] = slots;
			}

			meta.roundIndex = round;
			meta.assignments = assignments;
			meta.roundSwapPool = swapPool.length > 0 ? swapPool : [...new Set(prompts)];
			meta.phase = "writing";
			meta.error = null;
			meta.lastMvp = null;
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true, roundIndex: round });
		}

		case "openVoting": {
			if (meta.phase !== "reveal") return jsonResponse({ error: "bad_phase" }, 409);
			meta.phase = "voting";
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true });
		}

		case "tally": {
			if (meta.phase !== "voting") return jsonResponse({ error: "bad_phase" }, 409);
			const round = meta.roundIndex;
			const [voteBlobs, subBlobs] = await Promise.all([
				listJSON(store, keys.votePrefix(code, round)),
				listJSON(store, keys.subPrefix(code, round)),
			]);

			const tally = new Map();
			for (const { value: v } of voteBlobs) {
				tally.set(v.targetSubId, (tally.get(v.targetSubId) || 0) + 1);
			}

			let winner = null;
			let best = 0;
			for (const [target, votes] of tally) {
				if (votes > best) { best = votes; winner = target; }
			}

			let mvp = null;
			if (winner) {
				const sub = subBlobs
					.map((b) => b.value)
					.find((s) => subId(s.playerId, s.slotId) === winner);
				if (sub) {
					const player = (await store.get(keys.player(code, sub.playerId), { type: "json" })) || {};
					meta.leaderboard = meta.leaderboard || {};
					meta.leaderboard[sub.playerId] = (meta.leaderboard[sub.playerId] || 0) + 1;
					mvp = {
						playerId: sub.playerId,
						name: player.name || "Someone",
						value: sub.value,
						prompt: sub.prompt,
						votes: best,
					};
				}
			}

			meta.lastMvp = mvp;
			meta.phase = "results";
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true, mvp });
		}

		case "setFacts": {
			meta.facts = typeof body?.facts === "string" ? body.facts.slice(0, 4000) : "";
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true });
		}

		case "finish": {
			meta.phase = "finished";
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true });
		}

		case "abortGenerating": {
			if (meta.phase !== "generating") return jsonResponse({ error: "bad_phase" }, 409);
			meta.phase = "writing";
			meta.error = "generation_failed";
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true });
		}

		case "reset": {
			meta.phase = "lobby";
			meta.roundIndex = -1;
			meta.assignments = {};
			meta.roundSwapPool = [];
			meta.error = null;
			meta.leaderboard = {};
			meta.lastMvp = null;
			meta.version++;
			await writeMeta(store, code, meta);
			return jsonResponse({ ok: true });
		}

		default:
			return jsonResponse({ error: "unknown_action" }, 400);
	}
}
