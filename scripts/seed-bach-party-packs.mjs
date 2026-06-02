#!/usr/bin/env node
/**
 * Seed allowlisted party packs into Netlify Blobs (bach-sessions) at deploy time.
 *
 * Netlify build: set PRIVATE_ACCESS_GITHUB_TOKEN (read private repo) + NETLIFY_AUTH_TOKEN for Blobs.
 * Local: reads ../private/dotme/bach if present, or set BACH_PARTY_PACKS_DIR.
 *
 *   npm run seed:bach-packs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getStore } from "@netlify/blobs";
import { validatePartyPack } from "../src/components/Bach/validatePartyPack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const STORE_NAME = "bach-sessions";
const PACKS_BLOB_PREFIX = "party-packs";
const MANIFEST_KEY = `${PACKS_BLOB_PREFIX}/manifest`;
const DEFAULT_LOCAL = resolve(REPO_ROOT, "../private/dotme/bach");
const PRIVATE_SUBDIR = "dotme/bach";

const ALLOWLIST = (process.env.BACH_PARTY_SEED_ALLOWLIST || "matthew-jane")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

const PACK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function log(msg) {
	console.log(`[seed-bach-party-packs] ${msg}`);
}

function clonePrivateRepo() {
	const token = process.env.PRIVATE_ACCESS_GITHUB_TOKEN?.trim();
	if (!token) {
		throw new Error("PRIVATE_ACCESS_GITHUB_TOKEN is required on Netlify to clone the private party-pack repo.");
	}

	const branch = process.env.BACH_PRIVATE_BRANCH?.trim() || "main";
	let repo = process.env.BACH_PRIVATE_REPO?.trim() || "maxeisen/private";
	if (!repo.endsWith(".git")) repo = `${repo.replace(/\/$/, "")}.git`;
	if (!repo.startsWith("http")) repo = `https://github.com/${repo}`;

	const authed = repo.replace(
		/^https:\/\/github\.com\//,
		`https://x-access-token:${token}@github.com/`,
	);

	const tmp = mkdtempSync(join(tmpdir(), "bach-private-"));
	try {
		execSync(`git clone --depth 1 --branch ${branch} ${authed} ${tmp}`, {
			stdio: "inherit",
		});
		return join(tmp, PRIVATE_SUBDIR);
	} catch (err) {
		rmSync(tmp, { recursive: true, force: true });
		throw err;
	}
}

function resolvePacksDir() {
	const explicit = process.env.BACH_PARTY_PACKS_DIR?.trim();
	if (explicit && existsSync(explicit)) return explicit;

	if (existsSync(DEFAULT_LOCAL)) return DEFAULT_LOCAL;

	if (process.env.PRIVATE_ACCESS_GITHUB_TOKEN?.trim()) {
		const cloned = clonePrivateRepo();
		log(`cloned private repo → ${cloned}`);
		return cloned;
	}

	return null;
}

function loadPackFile(dir, id) {
	const path = join(dir, `${id}.json`);
	if (!existsSync(path)) {
		throw new Error(`Missing pack file: ${path}`);
	}
	const raw = JSON.parse(readFileSync(path, "utf8"));
	const problem = validatePartyPack(raw);
	if (problem) throw new Error(`Invalid pack "${id}": ${problem}`);
	if (raw.id && raw.id !== id) {
		log(`warning: pack file ${id}.json has id "${raw.id}" — using filename id`);
	}
	return { ...raw, id: raw.id || id };
}

async function main() {
	const onNetlify = Boolean(process.env.NETLIFY || process.env.CONTEXT);
	const packsDir = resolvePacksDir();

	if (!packsDir) {
		if (onNetlify) {
			throw new Error(
				"No party pack source: set PRIVATE_ACCESS_GITHUB_TOKEN, or add ../private/dotme/bach, or BACH_PARTY_PACKS_DIR.",
			);
		}
		log("skip — no local private packs dir and no PRIVATE_ACCESS_GITHUB_TOKEN (use BACH_PARTY_JSON_PATH in dev).");
		return;
	}

	for (const id of ALLOWLIST) {
		if (!PACK_ID_RE.test(id)) throw new Error(`Invalid allowlist id: ${id}`);
	}

	const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
	const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_API_TOKEN;

	if (!siteID || !token) {
		if (onNetlify) {
			throw new Error(
				"Missing SITE_ID/NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN — add a Netlify personal access token with Blobs scope to build env.",
			);
		}
		log("skip — no Netlify site credentials (run on Netlify build, or set SITE_ID + NETLIFY_AUTH_TOKEN).");
		return;
	}

	const store = getStore({
		name: STORE_NAME,
		siteID,
		token,
		consistency: "strong",
	});

	const manifest = [];
	for (const id of ALLOWLIST) {
		const pack = loadPackFile(packsDir, id);
		const key = `${PACKS_BLOB_PREFIX}/${id}`;
		await store.setJSON(key, pack, {
			metadata: { seededAt: new Date().toISOString(), title: pack.title || id },
		});
		manifest.push({
			id,
			title: pack.title || id,
		});
		log(`wrote ${key} (${pack.title || id})`);
	}

	await store.setJSON(MANIFEST_KEY, manifest);
	log(`wrote ${MANIFEST_KEY} (${manifest.length} packs)`);

	const activeKey = "__active_party_pack_id__";
	const currentActive = await store.get(activeKey, { type: "text" });
	if (!currentActive && manifest.length > 0) {
		await store.set(activeKey, manifest[0].id);
		log(`set default active pack → ${manifest[0].id}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
