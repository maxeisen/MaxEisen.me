<!--
    /resume — the résumé as a page of the site rather than a separate
    document. Content lives in public/content/resume.json; edit that, not
    this file, to change what it says.

    On screen it wears the site's theme like any other route. The print
    stylesheet below turns it into a single black-on-white Letter page: no
    nav, no buttons, no theme colours, tighter type.

    "Save as PDF" downloads that page, already printed: public/MaxEisen_
    Resume.pdf, made by `npm run resume:pdf` and committed. It used to open
    the print dialog, which does nothing in the home-screen app on iOS; a
    file works the same everywhere. A test fails the build if the PDF falls
    behind this page or resume.json — see scripts/lib/resumePdf.mjs.
-->
<script>
    import SiteNav from "../../lib/ui/SiteNav.svelte";
    import PageHeader from "../../lib/ui/PageHeader.svelte";
    import resume from "@content/resume.json";
    import GlobeIcon from "svelte-icons/io/IoIosGlobe.svelte";
    import MailIcon from "svelte-icons/io/IoIosMail.svelte";
    import PhoneIcon from "svelte-icons/io/IoIosCall.svelte";
    import LinkedInIcon from "svelte-icons/io/IoLogoLinkedin.svelte";
    import GitHubIcon from "svelte-icons/io/IoLogoGithub.svelte";

    const ICONS = { web: GlobeIcon, email: MailIcon, phone: PhoneIcon, linkedin: LinkedInIcon, github: GitHubIcon };
    const PAGE_TITLE = "Resume — Max Eisen";
    const PDF_FILE = "MaxEisen_Resume.pdf";

    const range = (start, end) => `${start} – ${end}`;
    // Links inside a bullet open elsewhere; the content file writes plain <a>s.
    const external = (html) => html.replaceAll("<a ", '<a target="_blank" rel="noreferrer" ');
</script>

<svelte:head>
    <title>{PAGE_TITLE}</title>
    <meta name="description" content="Max Eisen's résumé — software engineer in Toronto." />
</svelte:head>

<SiteNav />

<main class="resume-page">
    <PageHeader kicker="Résumé" title={resume.name} subtitle="{resume.title} · {resume.location}">
        {#snippet aside()}
            <a class="save" href="/{PDF_FILE}" download={PDF_FILE} type="application/pdf">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M3 13.5h10" /></svg>
                Save as PDF
            </a>
        {/snippet}
    </PageHeader>

    <article class="sheet surface">
        <header class="print-head">
            <h1>{resume.name}</h1>
            <p>{resume.title} · {resume.location}</p>
        </header>

        <aside class="side">
            <picture>
                <source srcset="{resume.headshot}.webp" type="image/webp" />
                <img class="headshot" src="{resume.headshot}.png" alt={resume.name} width="320" height="320" />
            </picture>

            <ul class="contact">
                {#each resume.contact as c (c.kind)}
                    {@const Icon = ICONS[c.kind]}
                    <li>
                        <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                            <span class="icon" aria-hidden="true"><Icon /></span>{c.label}
                        </a>
                    </li>
                {/each}
            </ul>

            <section>
                <h2>Technologies</h2>
                <dl class="skills">
                    {#each resume.skills as s (s.category)}
                        <div><dt>{s.category}</dt><dd>{s.items}</dd></div>
                    {/each}
                </dl>
            </section>

            <section>
                <h2>Interests</h2>
                <p class="interests">{resume.interests.join(", ")}</p>
            </section>
        </aside>

        <div class="main">
            <section>
                <h2>Experience</h2>
                {#each resume.experience as job (job.company + job.start)}
                    <div class="entry">
                        <div class="entry-head">
                            <h3>{job.position} <span class="at">at <a href={job.companyUrl} target="_blank" rel="noreferrer">{job.company}</a></span></h3>
                            <span class="when">{range(job.start, job.end)}</span>
                        </div>
                        <p class="where">{job.location}</p>
                        <ul class="bullets">
                            {#each job.bullets as bullet}
                                <li>{@html external(bullet)}</li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </section>

            <section>
                <h2>Education</h2>
                {#each resume.education as ed (ed.school)}
                    <div class="entry">
                        <div class="entry-head">
                            <h3>{ed.school} <span class="at">{ed.location}</span></h3>
                            <span class="when">{range(ed.start, ed.end)}</span>
                        </div>
                        <p class="where">{ed.degree}</p>
                        {#if ed.note}<p class="note">{ed.note}</p>{/if}
                    </div>
                {/each}
            </section>
        </div>
    </article>
</main>

<style>
    .resume-page {
        max-width: 1000px;
        margin: 0 auto;
        padding: var(--space-7) var(--page-gutter) var(--space-8);
    }

    .save {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        height: 36px;
        padding: 0 14px;
        border: 0;
        border-radius: var(--radius);
        background: var(--text-strong);
        color: var(--bg);
        font: inherit;
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        cursor: pointer;
        transition: background var(--dur-fast) var(--ease);
    }
    .save:hover { background: var(--text); color: var(--bg); }
    .save svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

    /* The sheet: a sidebar of who-and-how-to-reach, and the record. */
    .sheet {
        display: grid;
        grid-template-columns: 220px minmax(0, 1fr);
        gap: var(--space-7);
        padding: var(--space-7);
    }
    .print-head { display: none; }

    h2 {
        margin: 0 0 var(--space-3);
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--border);
        font-size: var(--font-sm);
        font-weight: var(--weight-semibold);
        letter-spacing: 0;
        color: var(--text-strong);
    }
    section + section { margin-top: var(--space-6); }

    .headshot {
        display: block;
        width: 100%;
        max-width: 160px;
        height: auto;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: var(--radius-lg);
        background: var(--surface-2);
    }

    .contact { list-style: none; margin: var(--space-5) 0 var(--space-6); padding: 0; }
    .contact li + li { margin-top: var(--space-2); }
    .contact a {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-sm);
        color: var(--text);
        overflow-wrap: break-word;
    }
    .contact a:hover { color: var(--accent); }
    .icon { flex: none; width: 16px; height: 16px; color: var(--text-3); }

    .skills { margin: 0; }
    .skills div + div { margin-top: var(--space-2); }
    .skills dt { font-size: var(--font-xs); font-weight: var(--weight-medium); color: var(--text-2); }
    .skills dd { margin: 0; font-size: var(--font-sm); line-height: 1.45; color: var(--text); }
    .interests { margin: 0; font-size: var(--font-sm); line-height: 1.5; color: var(--text); }

    .entry + .entry { margin-top: var(--space-5); }
    .entry-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 2px var(--space-4);
    }
    h3 {
        margin: 0;
        font-size: var(--font-md);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        color: var(--text-strong);
    }
    .at { font-weight: var(--weight-regular); color: var(--text-2); }
    .at a { color: inherit; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 0.2em; }
    .at a:hover { color: var(--accent); }
    .when { font-size: var(--font-xs); font-variant-numeric: tabular-nums; color: var(--text-3); white-space: nowrap; }
    .where { margin: 2px 0 0; font-size: var(--font-xs); color: var(--text-3); }
    .bullets { margin: var(--space-2) 0 0; padding-left: 1.1em; }
    .bullets li { font-size: var(--font-sm); line-height: 1.55; color: var(--text); }
    .bullets li + li { margin-top: var(--space-1); }
    .bullets li::marker { color: var(--text-3); }
    .bullets :global(strong) { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .bullets :global(a) { color: inherit; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 0.2em; }
    .bullets :global(a:hover) { color: var(--accent); }
    .note { margin: var(--space-2) 0 0; font-size: var(--font-sm); line-height: 1.55; color: var(--text-2); }

    @media (max-width: 760px) {
        .sheet { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); padding: var(--space-5); }
        .headshot { max-width: 112px; }
        .contact { margin: var(--space-4) 0 var(--space-5); }
    }

    /* === Print: one Letter page, black on white ======================== */
    @page { size: letter; margin: 0.5in 0.55in; }

    @media print {
        /* The light palette regardless of the theme on screen. */
        :global(html[data-theme]) {
            --bg: #fff;
            --surface: #fff;
            --surface-2: #f2efe9;
            --border: #d9d4ca;
            --border-strong: #b8b0a2;
            --text-strong: #000;
            --text: #1d1b17;
            --text-2: #4d473d;
            --text-3: #6b6457;
            --accent: #1d1b17;
            color-scheme: light;
            background: #fff;
        }
        :global(.site-nav),
        .resume-page > :global(.page-header) { display: none; }

        .resume-page { max-width: none; padding: 0; }
        .sheet {
            grid-template-columns: 1.8in minmax(0, 1fr);
            gap: 0.3in;
            padding: 0;
            border: 0;
            border-radius: 0;
            font-size: 9.5pt;
        }
        .print-head {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            grid-column: 1 / -1;
            padding-bottom: 8pt;
            border-bottom: 1.5pt solid #000;
        }
        .print-head h1 { margin: 0; font-size: 20pt; font-weight: 600; letter-spacing: -0.02em; }
        .print-head p { margin: 0; font-size: 10pt; color: var(--text-2); }

        h2 { margin-bottom: 5pt; padding-bottom: 3pt; font-size: 9pt; }
        section + section { margin-top: 12pt; }
        .headshot { max-width: 1.5in; }
        .contact { margin: 10pt 0 14pt; }
        .contact li + li { margin-top: 4pt; }
        .contact a, .skills dd, .interests, .bullets li, .note { font-size: 8.5pt; }
        .icon { width: 11px; height: 11px; }
        .skills dt, .when, .where { font-size: 8pt; }
        .skills div + div { margin-top: 4pt; }
        h3 { font-size: 10pt; }
        .entry + .entry { margin-top: 10pt; }
        .bullets { margin-top: 3pt; }
        .bullets li { line-height: 1.4; }
        .bullets li + li { margin-top: 2pt; }
        .entry, .side section { break-inside: avoid; }
        a, .at a, .bullets :global(a) { text-decoration: none !important; }
    }
</style>
