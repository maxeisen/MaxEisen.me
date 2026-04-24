<script>
    import OpenLogo from 'svelte-icons/io/IoMdOpen.svelte';
    import CodeLogo from 'svelte-icons/io/IoIosCode.svelte';

    export let name;
    export let technologies;
    export let year;
    export let bullets;
    export let githubLink;
    export let projectLink;
    export let screenshot;
</script>

<div class="project-modal">
    <h1 class="modal-name" style="text-align: center;">{name} ({year})</h1>
    <h3 class="modal-description" style="text-align: center;">Developed with: <b class="technologies">{technologies}</b></h3>
    <div class="project-links-container">
        {#if projectLink}
            <a class="project-link" href={projectLink} rel="noreferrer" target="_blank"><OpenLogo /></a>
        {/if}
        {#if githubLink}
            <a class="project-link" href={githubLink} rel="noreferrer" target="_blank"><CodeLogo /></a>
        {/if}
    </div>
    <ul class="modal-description">
        {#each bullets as bullet}
            <li>{@html bullet}</li>
        {/each}
    </ul>
    <picture>
        <source srcset="./img/screenshots/{screenshot}.webp" type="image/webp">
        <source srcset="./img/screenshots/{screenshot}.jpg" type="image/jpeg">
        <img class="screenshot" src="./img/screenshots/{screenshot}.webp" alt="{name} screenshot">
    </picture>
</div>

<style>
    /* :global() so styles apply when modal is rendered via dynamic component */
    :global(.project-modal) {
        color: black;
    }

    :global(.project-modal .modal-name) {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: rgb(0, 49, 82);
        font-size: 35px;
        margin: 15px 15px 10px 15px;
        color: var(--modal-title-colour);
    }

    :global(.project-modal .technologies) {
        font-weight: 300;
    }

    :global(.project-modal .modal-description) {
        margin: 10px auto 10px auto;
        color: var(--modal-text-colour);
        line-height: 1.6;
    }

    :global(.project-modal ul.modal-description li) {
        margin-bottom: 10px;
    }

    :global(.project-modal ul.modal-description li:last-child) {
        margin-bottom: 0;
    }

    :global(.project-modal .screenshot) {
        display: block;
        max-width: 100%;
        max-height: min(42vh, 340px);
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 5px;
        box-shadow: 0px 0px 10px #0000009a;
        margin: 20px auto 0 auto;
    }

    :global(.project-modal .project-links-container) {
        display: flex;
        margin: auto;
        padding-top: 10px;
        justify-content: center;
    }

    :global(.project-modal .project-link) {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: var(--modal-link-colour);
        width: 30px;
        height: 30px;
        margin: 0 10px 0 10px;
    }

    :global(.project-modal .project-link:hover) {
        color: var(--link-hover-colour);
    }
</style>
