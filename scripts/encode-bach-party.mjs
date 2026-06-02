#!/usr/bin/env node
/** Print base64 for Netlify env BACH_PARTY_JSON_BASE64 */
import { readFileSync } from "node:fs";

const path = process.argv[2] || "private/bach/matthew-jane.json";
const json = readFileSync(path, "utf8");
JSON.parse(json);
const b64 = Buffer.from(json, "utf8").toString("base64");
console.log(`File: ${path} (${json.length} bytes)`);
console.log("\nSet in Netlify → Environment variables:\n");
console.log(`BACH_PARTY_JSON_BASE64=${b64}`);
