import generic from "@content/bach/generic.json";
import defaultParty from "@content/bach/parties/default.json";

const PARTIES = {
	default: defaultParty,
};

export const DEFAULT_PARTY_ID = "default";

/** Party pack from bach-party-pack (not in git). */
let privatePackRaw = null;

export function setPrivatePartyPack(raw) {
	privatePackRaw = raw;
}

export function clearPrivatePartyPack() {
	privatePackRaw = null;
}

export function hasPrivatePartyPack() {
	return privatePackRaw != null;
}

function interpolate(text, names) {
	return text
		.replaceAll("{groom}", names.groom)
		.replaceAll("{partner}", names.partner);
}

/** Load a party pack: names resolved, optional generic warm-up pools merged in. */
function resolveRawParty(partyId = DEFAULT_PARTY_ID) {
	if (privatePackRaw) return privatePackRaw;
	const raw = PARTIES[partyId] ?? PARTIES[DEFAULT_PARTY_ID];
	if (!raw) throw new Error(`Unknown bach party: ${partyId}`);
	return raw;
}

export function getParty(partyId = DEFAULT_PARTY_ID) {
	const raw = resolveRawParty(partyId);

	const names = { groom: raw.groom, partner: raw.partner };
	const pools = (raw.pools || []).map((pool) => ({
		...pool,
		label: interpolate(pool.label || pool.id, names),
		prompts: pool.prompts.map((p) => interpolate(p, names)),
	}));

	if (raw.includeGenericPools) {
		for (const g of generic.pools || []) {
			pools.push({
				...g,
				label: interpolate(g.label || g.id, names),
				prompts: g.prompts.map((p) => interpolate(p, names)),
			});
		}
	}

	return {
		...raw,
		slotsPerPlayer: raw.slotsPerPlayer ?? generic.slotsPerPlayer ?? 3,
		pools,
		defaultFacts: raw.defaultFacts?.trim() || "",
		storyTone: raw.storyTone?.trim() || "",
	};
}

/** @typedef {"boys" | "everyone"} BachAudience */

/** Pools tagged `audience: "boys"` only show for boys; untagged pools show for both. */
export function poolsForAudience(pools, audience = "everyone") {
	if (!pools?.length) return [];
	return pools.filter((pool) => {
		const tag = pool.audience;
		if (!tag || tag === "all") return true;
		return tag === audience;
	});
}

function shuffle(arr) {
	const next = [...arr];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

/** Draw prompts without replacement; resets the deck when the pool runs dry. */
export function drawPrompts(pool, usedSet, needCount) {
	let available = pool.prompts.filter((p) => !usedSet.has(p));
	if (available.length < needCount) {
		usedSet.clear();
		available = [...pool.prompts];
	}
	const drawn = shuffle(available).slice(0, needCount);
	for (const p of drawn) usedSet.add(p);
	return drawn;
}

export function loadUsedPrompts(code) {
	try {
		const raw = sessionStorage.getItem(`bach:used:${code}`);
		if (raw) return new Set(JSON.parse(raw));
	} catch {}
	return new Set();
}

export function saveUsedPrompts(code, usedSet) {
	try {
		sessionStorage.setItem(`bach:used:${code}`, JSON.stringify([...usedSet]));
	} catch {}
}

export function clearUsedPrompts(code) {
	try { sessionStorage.removeItem(`bach:used:${code}`); } catch {}
}
