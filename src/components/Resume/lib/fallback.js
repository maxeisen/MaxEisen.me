// The résumé as plain HTML, for browsers that never run the SPA.
//
// /resume is served from a copy of the built SPA shell (RESUME_SHELL) whose
// <noscript> holds this markup instead of the site-wide "needs JavaScript"
// note. JS visitors boot the app from the same document and never see it.
// It's made at build time from public/content/resume.json — the content is
// static, so there's nothing to fetch per request — by the vite plugin in
// ./shellPlugin.js.
//
// Deliberately basic: the same facts as the page, in document order, styled
// only by global.css and the few rules below. The PDF link is the polished
// version.

export const RESUME_SHELL = "resume.shell.html";
const PDF_HREF = "/MaxEisen_Resume.pdf";

// Lives inside <noscript>, so it never applies when the app runs. Tokens
// come from global.css on the shell; fallbacks cover a client that skipped CSS.
const STYLE = `<style>
.resume-noscript { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
.resume-noscript h1 { margin: 0; font-size: 2rem; }
.resume-noscript h2 { margin: 2rem 0 0.75rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--border, #ccc); font-size: 1rem; }
.resume-noscript h3 { margin: 1.25rem 0 0; font-size: 1rem; }
.resume-noscript .sub, .resume-noscript .meta { margin: 0.2rem 0 0; color: var(--text-2, inherit); font-size: 0.875rem; }
.resume-noscript ul { margin: 0.5rem 0 0; padding-left: 1.1em; }
.resume-noscript li { margin-top: 0.25rem; font-size: 0.9375rem; }
.resume-noscript .contact { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; }
.resume-noscript .note { margin: 1rem 0 0; font-size: 0.875rem; color: var(--text-2, inherit); }
</style>`;

export function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const t = escapeHtml;
const range = (start, end) => `${t(start)} – ${t(end)}`;

/**
 * @param {object} resume public/content/resume.json
 * @returns {string} inner HTML for the <noscript> (not a full document)
 */
export function renderResumeFallback(resume = {}) {
	const contact = (resume.contact ?? [])
		.map((c) => `<li><a href="${t(c.href)}">${t(c.label)}</a></li>`)
		.join("");

	// Bullets are HTML in the content file (bold product names, links) —
	// trusted, ours, and rendered with {@html} by the page too.
	const experience = (resume.experience ?? [])
		.map((job) => [
			`<h3>${t(job.position)}, <a href="${t(job.companyUrl)}">${t(job.company)}</a></h3>`,
			`<p class="meta">${range(job.start, job.end)} · ${t(job.location)}</p>`,
			job.bullets?.length ? `<ul>${job.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : "",
		].join("\n"))
		.join("\n");

	const education = (resume.education ?? [])
		.map((ed) => [
			`<h3>${t(ed.school)}</h3>`,
			`<p class="meta">${t(ed.degree)} · ${range(ed.start, ed.end)} · ${t(ed.location)}</p>`,
			ed.note ? `<p class="meta">${t(ed.note)}</p>` : "",
		].join("\n"))
		.join("\n");

	const skills = (resume.skills ?? [])
		.map((s) => `<li><strong>${t(s.category)}:</strong> ${t(s.items)}</li>`)
		.join("");

	return [
		STYLE,
		`<main class="resume-noscript">`,
		`<p><a href="/">maxeisen.me</a></p>`,
		`<h1>${t(resume.name)}</h1>`,
		`<p class="sub">${t(resume.title)} · ${t(resume.location)}</p>`,
		`<ul class="contact">${contact}</ul>`,
		`<p class="note">This is the plain version of the page. <a href="${PDF_HREF}" download>Download the résumé as a PDF</a> for the formatted one.</p>`,
		`<h2>Experience</h2>`,
		experience,
		`<h2>Education</h2>`,
		education,
		`<h2>Technologies</h2>`,
		`<ul>${skills}</ul>`,
		resume.interests?.length ? `<h2>Interests</h2>\n<p>${t(resume.interests.join(", "))}</p>` : "",
		`</main>`,
	].filter(Boolean).join("\n");
}

/**
 * Swap the shell's <noscript> for the résumé. Everything else — the hashed
 * scripts, #app — stays as built.
 *
 * @param {string} html the built index.html
 * @param {string} innerHtml renderResumeFallback() output
 */
export function injectResumeFallback(html, innerHtml) {
	const out = String(html ?? "");
	const block = `<noscript>\n${innerHtml}\n</noscript>`;
	if (/<noscript[\s\S]*?<\/noscript>/i.test(out)) {
		// A function replacement, so "$" in the content isn't read as a pattern.
		return out.replace(/<noscript[\s\S]*?<\/noscript>/i, () => block);
	}
	if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, () => `${block}\n</body>`);
	return `${out}\n${block}`;
}
