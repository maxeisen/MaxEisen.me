#!/usr/bin/env node
/**
 * One-time script to create netlify/functions/assets/signer.enc and print the decryption key.
 * Use when you want to keep Functions env under 4KB: only PASSKIT_SIGNER_SECRET (32-byte key) goes in env.
 *
 * Usage (from repo root):
 *   node scripts/create-signer-enc.js [path/to/cert.pem] [path/to/key.pem]
 * Defaults: signer-cert.pem, signer-key.pem in current directory.
 *
 * Then:
 * 1. Add the printed key to Netlify env as PASSKIT_SIGNER_SECRET (Functions scope).
 * 2. Commit netlify/functions/assets/signer.enc (the file is encrypted; the key is the secret).
 * 3. Remove PASSKIT_SIGNER_BUNDLE (and CERT/KEY) from Netlify so env stays small.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = process.argv[2] || "signer-cert.pem";
const keyPath = process.argv[3] || "signer-key.pem";

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
	console.error("Cert or key file not found. Pass paths to your Pass Type ID PEM files:");
	console.error("  node scripts/create-signer-enc.js <cert.pem> <key.pem>");
	console.error("Example: node scripts/create-signer-enc.js ./signer-cert.pem ./signer-key.pem");
	process.exit(1);
}
const cert = fs.readFileSync(certPath, "utf8").trim();
const key = fs.readFileSync(keyPath, "utf8").trim();
const bundle = cert + "\n---KEY---\n" + key;
const compressed = zlib.brotliCompressSync(Buffer.from(bundle, "utf8"));

const keyBytes = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes, iv);
const encrypted = Buffer.concat([cipher.update(compressed), cipher.final(), cipher.getAuthTag()]);
const out = Buffer.concat([iv, encrypted]);

const outPath = path.join(__dirname, "..", "netlify", "functions", "assets", "signer.enc");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);

console.log("Wrote", outPath);
console.log("\nAdd this to Netlify env as PASSKIT_SIGNER_SECRET (Functions scope):\n");
console.log(keyBytes.toString("base64"));
console.log("");
