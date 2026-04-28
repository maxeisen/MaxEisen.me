#!/usr/bin/env node
/**
 * One-shot helper to obtain a Strava refresh token for the Last Activity widget.
 *
 * Setup:
 *   1. Create an API app at https://www.strava.com/settings/api
 *   2. Set "Authorization Callback Domain" to: 127.0.0.1
 *   3. Run with your client credentials:
 *
 *      STRAVA_CLIENT_ID=xxx STRAVA_CLIENT_SECRET=yyy node scripts/get_strava_refresh_token.js
 *
 *   4. Open the printed URL, log in to Strava, approve.
 *   5. The refresh token will print in your terminal.
 *   6. Add to Netlify env vars (Functions scope):
 *        STRAVA_CLIENT_ID
 *        STRAVA_CLIENT_SECRET
 *        STRAVA_REFRESH_TOKEN
 */

import http from "node:http";

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:8889/exchange_token";
const SCOPES = "read,activity:read";

if (!CLIENT_ID || !CLIENT_SECRET) {
	console.error("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in the env before running.");
	process.exit(1);
}

const authUrl =
	`https://www.strava.com/oauth/authorize` +
	`?client_id=${CLIENT_ID}` +
	`&response_type=code` +
	`&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
	`&approval_prompt=auto` +
	`&scope=${encodeURIComponent(SCOPES)}`;

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, REDIRECT_URI);
	if (url.pathname !== "/exchange_token") {
		res.writeHead(404);
		res.end();
		return;
	}
	const code = url.searchParams.get("code");
	if (!code) {
		res.writeHead(400);
		res.end("No code received");
		return;
	}
	try {
		const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
				grant_type: "authorization_code",
				code,
			}),
		});
		const data = await tokenRes.json();
		if (data.refresh_token) {
			console.log("\n✅ Refresh token:\n");
			console.log("   " + data.refresh_token + "\n");
			console.log("Set this as STRAVA_REFRESH_TOKEN in Netlify env vars (Functions scope).\n");
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end("<h1>Got it.</h1><p>Refresh token printed in your terminal. You can close this tab.</p>");
			setTimeout(() => process.exit(0), 500);
		} else {
			console.error("Strava did not return a refresh token:", data);
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

server.listen(8889, "127.0.0.1", () => {
	console.log("\n1. Open this URL in your browser to authorize:\n");
	console.log("   " + authUrl + "\n");
	console.log("2. After approving, watch this terminal for the refresh token.\n");
});
