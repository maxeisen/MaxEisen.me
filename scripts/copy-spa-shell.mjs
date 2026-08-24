// After vite build, copy the hashed SPA shell so /training can inject a
// noscript dashboard into the real document rather than the source index.html
// (which still points at /src/main.js and would boot a blank page in production).

import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FROM = path.join(ROOT, "dist/index.html");
const DIR = path.join(ROOT, "netlify/functions/_generated");
const TO = path.join(DIR, "spa-shell.html");

await mkdir(DIR, { recursive: true });
await copyFile(FROM, TO);
console.log(`copied ${path.relative(ROOT, FROM)} → ${path.relative(ROOT, TO)}`);
