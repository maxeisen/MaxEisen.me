import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	validCode, validPlayerId, validPartyPackId,
	normalizePassword, subId, keys, randomCode, shuffle,
	withBachAuth, loadBachBinary,
	listReadyImageIds, readyPlacementIds,
} from "./_lib.js";

const URL_BASE = "https://example.com/.netlify/functions/bach-host";

function jsonRequest({ method = "POST", password, body } = {}) {
	const headers = {};
	if (password !== undefined) headers["x-bach-password"] = password;
	const init = { method, headers };
	if (body !== undefined && method !== "GET") {
		init.body = typeof body === "string" ? body : JSON.stringify(body);
	}
	return new Request(URL_BASE, init);
}

describe("validators", () => {
	it("validCode accepts a 4-char uppercase alnum code", () => {
		expect(validCode("AB12")).toBe(true);
		expect(validCode("ZZZZ")).toBe(true);
	});

	it("validCode rejects lowercase, wrong length, symbols and non-strings", () => {
		expect(validCode("ab12")).toBe(false);
		expect(validCode("ABC")).toBe(false);
		expect(validCode("ABCDE")).toBe(false);
		expect(validCode("AB-2")).toBe(false);
		expect(validCode("")).toBe(false);
		expect(validCode(1234)).toBe(false);
		expect(validCode(null)).toBe(false);
	});

	it("validPlayerId accepts a UUID and rejects path-smuggling shapes", () => {
		expect(validPlayerId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
		expect(validPlayerId("not-a-uuid")).toBe(false);
		expect(validPlayerId("../../etc/passwd")).toBe(false);
		expect(validPlayerId("123e4567-e89b-12d3-a456-426614174000/extra")).toBe(false);
		expect(validPlayerId(undefined)).toBe(false);
	});

	it("validPartyPackId accepts plain slugs and rejects leading dash / uppercase", () => {
		expect(validPartyPackId("classic")).toBe(true);
		expect(validPartyPackId("pack-2024")).toBe(true);
		expect(validPartyPackId("-leading")).toBe(false);
		expect(validPartyPackId("Caps")).toBe(false);
		expect(validPartyPackId("with space")).toBe(false);
	});

	it("normalizePassword trims strings and coerces non-strings to empty", () => {
		expect(normalizePassword("  hi  ")).toBe("hi");
		expect(normalizePassword("")).toBe("");
		expect(normalizePassword(undefined)).toBe("");
		expect(normalizePassword(42)).toBe("");
	});
});

describe("key schema", () => {
	it("builds the expected blob keys", () => {
		expect(keys.meta("AB12")).toBe("AB12/meta");
		expect(keys.player("AB12", "p1")).toBe("AB12/player/p1");
		expect(keys.playerPrefix("AB12")).toBe("AB12/player/");
		expect(keys.sub("AB12", 2, "p1", "s0")).toBe("AB12/sub/2/p1/s0");
		expect(keys.subPrefix("AB12", 2)).toBe("AB12/sub/2/");
		expect(keys.story("AB12", 2)).toBe("AB12/story/2");
		expect(keys.storyAudio("AB12", 2)).toBe("AB12/story-audio/2.mp3");
		expect(keys.storyImage("AB12", 2, 3)).toBe("AB12/story-image/2/3.png");
		expect(keys.vote("AB12", 2, "p1")).toBe("AB12/vote/2/p1");
		expect(keys.partyPack("classic")).toBe("party-packs/classic");
	});

	it("subId joins player and slot with a double underscore", () => {
		expect(subId("p1", "s0")).toBe("p1__s0");
	});
});

describe("randomCode", () => {
	it("returns a code of the requested length from the safe alphabet", () => {
		const code = randomCode(4);
		expect(code).toHaveLength(4);
		// No ambiguous chars (0/O/1/I) and uppercase alnum only.
		expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
	});
});

describe("shuffle", () => {
	it("preserves the multiset of elements without mutating the input", () => {
		const input = [1, 2, 3, 4, 5];
		const out = shuffle(input);
		expect(out).toHaveLength(input.length);
		expect([...out].sort()).toEqual([...input].sort());
		expect(input).toEqual([1, 2, 3, 4, 5]);
	});
});

describe("story-image readiness index", () => {
	it("listReadyImageIds derives ids from stored image keys (no byte reads)", async () => {
		let usedPrefix = null;
		const store = {
			list: async ({ prefix }) => {
				usedPrefix = prefix;
				return {
					blobs: [
						{ key: "AB12/story-image/2/0.png" },
						{ key: "AB12/story-image/2/3.png" },
						{ key: "AB12/story-image/2/notes.txt" }, // ignored: not an image id
					],
				};
			},
		};
		const ready = await listReadyImageIds(store, "AB12", 2);
		expect(usedPrefix).toBe(keys.storyImagePrefix("AB12", 2));
		expect([...ready].sort()).toEqual([0, 3]);
	});

	it("readyPlacementIds keeps ready placements in order, skipping missing/invalid", () => {
		const placements = [{ id: 0 }, { id: 1 }, { id: 3 }, { id: -1 }, { id: "x" }];
		const readySet = new Set([0, 3]);
		// 1 is unready (partial/missing); -1 and "x" are invalid → all skipped.
		expect(readyPlacementIds(placements, readySet)).toEqual([0, 3]);
	});

	it("readyPlacementIds tolerates an empty/undefined manifest", () => {
		expect(readyPlacementIds([], new Set([1]))).toEqual([]);
		expect(readyPlacementIds(undefined, new Set([1]))).toEqual([]);
	});
});

describe("withBachAuth", () => {
	const PASSWORD = "let-me-in";
	beforeEach(() => {
		process.env.BACH_PASSWORD = PASSWORD;
	});
	afterEach(() => {
		delete process.env.BACH_PASSWORD;
	});

	it("rejects a non-POST method with 405", async () => {
		const gate = await withBachAuth(jsonRequest({ method: "GET" }));
		expect(gate.response?.status).toBe(405);
		expect(gate.body).toBeUndefined();
	});

	it("rejects a missing/wrong password with 401", async () => {
		const gate = await withBachAuth(jsonRequest({ password: "nope", body: { code: "AB12" } }));
		expect(gate.response?.status).toBe(401);
	});

	it("rejects an invalid JSON body with 400", async () => {
		const gate = await withBachAuth(jsonRequest({ password: PASSWORD, body: "{not json" }));
		expect(gate.response?.status).toBe(400);
		await expect(gate.response.json()).resolves.toEqual({ error: "Invalid JSON body" });
	});

	it("rejects an invalid session code with 400", async () => {
		const gate = await withBachAuth(jsonRequest({ password: PASSWORD, body: { code: "??" } }));
		expect(gate.response?.status).toBe(400);
		await expect(gate.response.json()).resolves.toEqual({ error: "invalid_code" });
	});

	it("accepts a valid request and upper-cases the code", async () => {
		const gate = await withBachAuth(jsonRequest({ password: PASSWORD, body: { code: "ab12", x: 1 } }));
		expect(gate.response).toBeUndefined();
		expect(gate.code).toBe("AB12");
		expect(gate.body).toEqual({ code: "ab12", x: 1 });
	});

	it("skips the code check when requireCode is false", async () => {
		const gate = await withBachAuth(
			jsonRequest({ password: PASSWORD, body: { facts: "hi" } }),
			{ requireCode: false },
		);
		expect(gate.response).toBeUndefined();
		expect(gate.code).toBe("");
		expect(gate.body).toEqual({ facts: "hi" });
	});
});

describe("loadBachBinary (pre-store gate)", () => {
	const PASSWORD = "let-me-in";
	beforeEach(() => {
		process.env.BACH_PASSWORD = PASSWORD;
	});
	afterEach(() => {
		delete process.env.BACH_PASSWORD;
	});

	function getRequest(query, password = PASSWORD) {
		const url = new URL(URL_BASE);
		for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
		return new Request(url, { method: "GET", headers: { "x-bach-password": password } });
	}

	it("rejects non-GET with 405", async () => {
		const req = new Request(URL_BASE, { method: "POST", headers: { "x-bach-password": PASSWORD } });
		const gate = await loadBachBinary(req);
		expect(gate.response?.status).toBe(405);
	});

	it("rejects a wrong password with 401", async () => {
		const gate = await loadBachBinary(getRequest({ code: "AB12", round: "0" }, "wrong"));
		expect(gate.response?.status).toBe(401);
	});

	it("rejects invalid params with 400 (bad code / round)", async () => {
		const gate = await loadBachBinary(getRequest({ code: "??", round: "0" }));
		expect(gate.response?.status).toBe(400);
		await expect(gate.response.json()).resolves.toEqual({ error: "invalid_params" });
	});

	it("requires a numeric id when withId is set", async () => {
		const gate = await loadBachBinary(
			getRequest({ code: "AB12", round: "0", id: "nope" }),
			{ withId: true },
		);
		expect(gate.response?.status).toBe(400);
		await expect(gate.response.json()).resolves.toEqual({ error: "invalid_params" });
	});
});
