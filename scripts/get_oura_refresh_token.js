#!/usr/bin/env node
/**
 * One-shot helper to obtain an Oura refresh token for the /training recovery
 * panel.
 *
 * Setup:
 *   1. Create an application at https://cloud.ouraring.com/oauth/applications
 *   2. Set its Redirect URI to exactly: http://localhost:8889/callback
 *      (Oura matches this string exactly. If it insists on a different form,
 *      register that instead and pass it as OURA_REDIRECT_URI below.)
 *   3. Run with your client credentials:
 *
 *      OURA_CLIENT_ID=xxx OURA_CLIENT_SECRET=yyy node scripts/get_oura_refresh_token.js
 *
 *   4. Open the printed URL, log in to Oura, approve.
 *   5. The refresh token will print in your terminal.
 *   6. Add to Netlify env vars (Functions scope):
 *        OURA_CLIENT_ID
 *        OURA_CLIENT_SECRET
 *        OURA_REFRESH_TOKEN
 *
 * Note what OURA_REFRESH_TOKEN is for, because it isn't the same job as
 * STRAVA_REFRESH_TOKEN. Oura invalidates a refresh token the moment it's spent
 * and returns a successor, so the live credential can't live in an environment
 * variable — it's kept in Blobs and rewritten on every rotation (see
 * netlify/functions/_shared/oura.js). This variable seeds the very first
 * refresh, and is retried automatically if the stored chain ever breaks. That's
 * the recovery path: re-run this script, paste the new value into Netlify, and
 * the next sync heals itself without a deploy.
 *
 * Re-run this whenever SCOPES below changes — a refresh token only ever carries
 * the scopes it was originally granted, so widening the list here has no effect
 * on production until the new token replaces OURA_REFRESH_TOKEN.
 *
 * Requires an active Oura membership: Gen 3 and Ring 4 data is gated behind it,
 * and without one the API returns 403 for the collections below.
 */

import http from "node:http";
import { randomBytes } from "node:crypto";

const CLIENT_ID = process.env.OURA_CLIENT_ID;
const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;
const REDIRECT_URI = process.env.OURA_REDIRECT_URI || "http://localhost:8889/callback";

// daily — daily_sleep, daily_readiness and the detailed sleep periods, which is
//   everything the recovery panel reads.
//
// Deliberately nothing else. `personal` (age, height, weight) and `heartrate`
// (continuous time-series) would both be granted happily and neither is used,
// and this is a public page: the narrowest token that does the job is the one
// worth holding. If Oura ever answers 401 naming a scope, it says which in the
// error detail — add it here and re-run.
const SCOPES = "daily";

if (!CLIENT_ID || !CLIENT_SECRET) {
	console.error("Set OURA_CLIENT_ID and OURA_CLIENT_SECRET in the env before running.");
	process.exit(1);
}

const callback = new URL(REDIRECT_URI);
const PORT = Number(callback.port) || 8889;

// Guards against a stray request to the callback port being taken for the real
// one. Cheap here, and the reason the parameter exists.
const STATE = randomBytes(16).toString("hex");

const authUrl =
	`https://cloud.ouraring.com/oauth/authorize` +
	`?client_id=${CLIENT_ID}` +
	`&response_type=code` +
	`&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
	`&state=${STATE}` +
	`&scope=${encodeURIComponent(SCOPES)}`;

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, REDIRECT_URI);
	if (url.pathname !== callback.pathname) {
		res.writeHead(404);
		res.end();
		return;
	}
	if (url.searchParams.get("state") !== STATE) {
		res.writeHead(400);
		res.end("State mismatch");
		return;
	}
	const code = url.searchParams.get("code");
	if (!code) {
		// Oura reports a refusal here rather than as a failed exchange.
		const denied = url.searchParams.get("error");
		console.error(denied ? `Oura returned an error: ${denied}` : "No code received");
		res.writeHead(400);
		res.end("No code received");
		return;
	}
	try {
		const tokenRes = await fetch("https://api.ouraring.com/oauth/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				grant_type: "authorization_code",
				redirect_uri: REDIRECT_URI,
				code,
			}),
		});
		const data = await tokenRes.json();
		if (data.refresh_token) {
			console.log("\n✅ Refresh token:\n");
			console.log("   " + data.refresh_token + "\n");
			console.log("Set this as OURA_REFRESH_TOKEN in Netlify env vars (Functions scope).");
			console.log("It seeds the first refresh; after that the live token lives in Blobs.\n");
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end("<h1>Got it.</h1><p>Refresh token printed in your terminal. You can close this tab.</p>");
			setTimeout(() => process.exit(0), 500);
		} else {
			console.error("Oura did not return a refresh token:", data);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
			process.exit(1);
		}
	} catch (err) {
		console.error(err);
		res.writeHead(500);
		res.end("Token exchange failed");
		process.exit(1);
	}
});

server.listen(PORT, "127.0.0.1", () => {
	console.log("\n1. Open this URL in your browser to authorize:\n");
	console.log("   " + authUrl + "\n");
	console.log("2. After approving, watch this terminal for the refresh token.\n");
});
