#!/usr/bin/env node
/**
 * One-shot helper to obtain a Spotify refresh token for the Now Playing widget.
 *
 * Setup:
 *   1. Create a Spotify app at https://developer.spotify.com/dashboard
 *   2. In the app settings, add this Redirect URI: http://127.0.0.1:8888/callback
 *   3. Run with your client credentials:
 *
 *      SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/get_spotify_refresh_token.js
 *
 *   4. Open the printed URL, log in to Spotify, approve.
 *   5. The refresh token will print in your terminal.
 *   6. Add these to Netlify Site Configuration → Environment variables (Functions scope):
 *        SPOTIFY_CLIENT_ID
 *        SPOTIFY_CLIENT_SECRET
 *        SPOTIFY_REFRESH_TOKEN  ← from this script
 */

import http from "node:http";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const SCOPES = "user-read-currently-playing user-read-recently-played";

if (!CLIENT_ID || !CLIENT_SECRET) {
	console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the env before running.");
	process.exit(1);
}

const authUrl =
	`https://accounts.spotify.com/authorize` +
	`?client_id=${CLIENT_ID}` +
	`&response_type=code` +
	`&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
	`&scope=${encodeURIComponent(SCOPES)}`;

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, REDIRECT_URI);
	if (url.pathname !== "/callback") {
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
		const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
			method: "POST",
			headers: {
				Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: REDIRECT_URI,
			}),
		});
		const data = await tokenRes.json();
		if (data.refresh_token) {
			console.log("\n✅ Refresh token:\n");
			console.log("   " + data.refresh_token + "\n");
			console.log("Set this as SPOTIFY_REFRESH_TOKEN in Netlify env vars (Functions scope).\n");
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end("<h1>Got it.</h1><p>Refresh token printed in your terminal. You can close this tab.</p>");
			setTimeout(() => process.exit(0), 500);
		} else {
			console.error("Spotify did not return a refresh token:", data);
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

server.listen(8888, "127.0.0.1", () => {
	console.log("\n1. Open this URL in your browser to authorize:\n");
	console.log("   " + authUrl + "\n");
	console.log("2. After approving, watch this terminal for the refresh token.\n");
});
