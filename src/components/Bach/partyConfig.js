import generic from "@content/bach/generic.json";
import matthewJane from "@content/bach/parties/matthew-jane.json";

const PARTIES = {
	"matthew-jane": matthewJane,
};

export const DEFAULT_PARTY_ID = "matthew-jane";

function interpolate(text, names) {
	return text
		.replaceAll("{groom}", names.groom)
		.replaceAll("{partner}", names.partner);
}

/** Load a party pack: names resolved, optional generic warm-up pools merged in. */
export function getParty(partyId = DEFAULT_PARTY_ID) {
	const raw = PARTIES[partyId];
	if (!raw) throw new Error(`Unknown bach party: ${partyId}`);

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
	};
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
