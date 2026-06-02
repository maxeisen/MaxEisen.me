// Fetch party pack JSON from the private GitHub repo (runtime, not deploy-only).

import { Buffer } from "node:buffer";
import { getEnv, validPartyPackId } from "./_lib.js";

const PACK_PATH_PREFIX = "dotme/bach";

export function getPartyAllowlist() {
	return (getEnv("BACH_PARTY_SEED_ALLOWLIST") || "matthew-jane")
		.split(",")
		.map((s) => s.trim())
		.filter((id) => validPartyPackId(id));
}

function parseRepo() {
	const raw = (getEnv("BACH_PRIVATE_REPO") || "maxeisen/private").trim();
	const slash = raw.indexOf("/");
	if (slash > 0) {
		return { owner: raw.slice(0, slash), repo: raw.slice(slash + 1).replace(/\.git$/, "") };
	}
	return { owner: "maxeisen", repo: raw.replace(/\.git$/, "") };
}

/** @returns {Promise<object|null>} */
export async function fetchPartyPackFromGitHub(packId) {
	if (!validPartyPackId(packId)) return null;

	const token = getEnv("PRIVATE_ACCESS_GITHUB_TOKEN")?.trim();
	if (!token) return null;

	const allowlist = getPartyAllowlist();
	if (!allowlist.includes(packId)) return null;

	const { owner, repo } = parseRepo();
	const branch = (getEnv("BACH_PRIVATE_BRANCH") || "main").trim();
	const path = `${PACK_PATH_PREFIX}/${packId}.json`;
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;

	try {
		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"User-Agent": "maxeisen-bach-party-pack",
			},
		});

		if (!res.ok) {
			console.warn("bach/github-pack fetch failed:", res.status, packId);
			return null;
		}

		const data = await res.json();
		if (!data?.content || data.encoding !== "base64") return null;

		const json = Buffer.from(data.content, "base64").toString("utf8");
		return JSON.parse(json);
	} catch (err) {
		console.warn("bach/github-pack error:", err?.message || err);
		return null;
	}
}
