// Pre-commit hook (.githooks/pre-commit): keep the committed résumé PDF in
// step with the résumé without anyone having to remember.
//
// When the commit stages a change to any file the PDF is built from (see
// inputFiles() in lib/resumePdf.mjs) and the PDF's lock no longer matches,
// this rebuilds the PDF and adds it and the lock to the same commit.
//
// The PDF is built from the files on disk, so if one of those files also
// has changes that aren't staged, the PDF wouldn't match what's committed.
// In that case this stops the commit and says what to do.
//
// Skip it for one commit with `git commit --no-verify`.

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { ROOT, PDF_PATH, LOCK_PATH, inputFiles, inputsFingerprint } from "./lib/resumePdf.mjs";

process.chdir(ROOT);

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);

const inputs = inputFiles();
const staged = new Set(git("diff", "--cached", "--name-only"));
if (!inputs.some((file) => staged.has(file))) process.exit(0);

const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));
if (lock.fingerprint === inputsFingerprint()) process.exit(0);

const unstaged = git("diff", "--name-only", "--", ...inputs);
if (unstaged.length) {
	console.error(
		`The résumé PDF needs rebuilding, but these files have changes that aren't staged:\n` +
		unstaged.map((file) => `  ${file}`).join("\n") +
		`\nStage them (or stash them) and commit again, so the PDF matches the commit.`,
	);
	process.exit(1);
}

console.log("Résumé changed: rebuilding public/MaxEisen_Resume.pdf…");
execFileSync(process.execPath, ["scripts/build-resume-pdf.mjs"], { stdio: "inherit" });
execFileSync("git", ["add", "--", PDF_PATH, LOCK_PATH], { stdio: "inherit" });
