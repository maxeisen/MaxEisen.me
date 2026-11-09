<script>
    import { getContext } from 'svelte';
    import ProjectModal from '../modals/ProjectModal.svelte';
    import projects from '@content/projects.json';
    import Section from '../../../lib/ui/Section.svelte';

    const { open } = getContext('simple-modal');

    const projectModal = (name, technologies, year, bullets, githubLink, projectLink, screenshot) => {
        open(ProjectModal, {
            name: name, technologies: technologies, year: year, bullets: bullets, githubLink: githubLink, projectLink: projectLink, screenshot: screenshot
        });
    };

</script>

<Section title="Projects" id="projects">
    <ul class="grid">
        {#each projects as proj}
            <li>
                <button
                    type="button"
                    class="project surface"
                    onclick={() => projectModal(proj.name, proj.technologies, proj.year, proj.bullets, proj.githubLink, proj.projectLink, proj.screenshot)}
                >
                    <span class="shot">
                        <img src="./img/screenshots/{proj.screenshot}.webp" alt="" loading="lazy" />
                    </span>
                    <span class="body">
                        <span class="head">
                            <span class="name">{proj.name}</span>
                            <span class="year">{proj.year}</span>
                        </span>
                        <span class="desc">{proj.shortDescription}</span>
                        <span class="tech">{proj.technologies}</span>
                    </span>
                </button>
            </li>
        {/each}
    </ul>
</Section>

<style>
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
        gap: var(--space-4);
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .grid li { display: flex; }
    .project {
        display: flex;
        flex-direction: column;
        width: 100%;
        padding: 0;
        overflow: hidden;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: border-color var(--dur-fast) var(--ease);
    }
    .project:hover { border-color: var(--border-strong); }
    .shot {
        display: block;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
    }
    .shot img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top;
        transition: transform 0.4s var(--ease);
    }
    .project:hover .shot img { transform: scale(1.02); }
    .body { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-4); }
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
    .name { font-weight: var(--weight-semibold); color: var(--text-strong); }
    .year { font-size: var(--font-xs); font-variant-numeric: tabular-nums; color: var(--text-3); white-space: nowrap; }
    .desc { font-size: var(--font-sm); line-height: 1.5; color: var(--text-2); }
    .tech { margin-top: var(--space-1); font-size: var(--font-xs); color: var(--text-3); }
</style>
