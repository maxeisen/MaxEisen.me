// Vite plugin: the /resume document, with the résumé in its <noscript>.
//
// Build: after vite writes the hashed index.html, emit a copy as
// dist/resume.shell.html with renderResumeFallback() in place of the
// site-wide noscript. netlify.toml rewrites /resume to it.
//
// Dev and preview do the same rewrite themselves, so `vite`, `netlify dev`
// (which proxies the rewritten /resume.shell.html to vite) and the e2e suite
// on `vite preview` all serve what production does.

import fs from "node:fs";
import path from "node:path";
import { RESUME_SHELL, injectResumeFallback, renderResumeFallback } from "./fallback.js";

const CONTENT = "public/content/resume.json";

function pathnameOf(url = "") {
	return url.split(/[?#]/)[0].replace(/\/$/, "") || "/";
}

export default function resumeShell() {
	let root = process.cwd();
	const readResume = () => JSON.parse(fs.readFileSync(path.join(root, CONTENT), "utf8"));
	const render = (html) => injectResumeFallback(html, renderResumeFallback(readResume()));

	return {
		name: "resume-shell",
		enforce: "post",

		configResolved(config) {
			root = config.root;
		},

		generateBundle(_options, bundle) {
			const index = bundle["index.html"];
			if (!index || index.type !== "asset") return;
			this.addWatchFile(path.join(root, CONTENT));
			this.emitFile({ type: "asset", fileName: RESUME_SHELL, source: render(String(index.source)) });
		},

		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const p = pathnameOf(req.url);
				if (p !== "/resume" && p !== `/${RESUME_SHELL}`) return next();
				try {
					const raw = fs.readFileSync(path.join(root, "index.html"), "utf8");
					const html = await server.transformIndexHtml(req.originalUrl ?? req.url, raw);
					res.setHeader("Content-Type", "text/html; charset=utf-8");
					res.end(render(html));
				} catch (err) {
					next(err);
				}
			});
		},

		configurePreviewServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (pathnameOf(req.url) === "/resume") req.url = `/${RESUME_SHELL}`;
				next();
			});
		},
	};
}
