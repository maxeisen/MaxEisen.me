<script>
    import { getContext } from 'svelte';
    import ProjectModal from './modals/ProjectModal.svelte';
    import { projects } from '../../public/content/projects.js';
    
    const { open } = getContext('simple-modal');

    const projectModal = (name, technologies, year, description, githubLink, projectLink, screenshot) => {
        open(ProjectModal, {
            name: name, technologies: technologies, year: year, description: description, githubLink: githubLink, projectLink: projectLink, screenshot: screenshot
        });
    };

</script>

<h1 class="section-title" id="projects" style="text-align: left;">Projects</h1>
<div class="project-subsection">
    {#each projects as proj}
        <div class="project-item" tabindex="0" style="background-image: url('./img/screenshots/{proj.screenshot}.webp')"
        on:click={() => projectModal(proj.name, proj.technologies, proj.year, proj.longDescription, proj.githubLink, proj.projectLink, proj.screenshot)}>
            <h2 class="project-name">{proj.name} {@html proj.emoji}</h2>
            <h2 class="project-year">{proj.year}</h2>
            <h2 class="project-tech">{proj.technologies}</h2>
            <p>{proj.shortDescription}</p>
        </div>
	{/each}
</div>

<style>
    .project-name {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 30px;
    }

    .project-year {
        font-size: 25px;
        font-weight: 300;
        margin: 5px auto 5px auto;
        color: var(--item-subtitle);
    }

    .project-tech {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 18px;
        color: var(--item-small-text);
        font-weight: 300;
    }
</style>