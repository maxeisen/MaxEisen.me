<script>
    export let position;
    export let company;
    export let companyLink;
    export let startDate;
    export let endDate;
    export let location;
    export let bullets;
</script>

<div class="experience-modal">
    <h1 class="modal-title">{position}</h1>
    <h2 class="modal-subtitle">
        {#if companyLink}
            <a href={companyLink} rel="noreferrer" target="_blank">{company} </a>
        {:else}
            {company}
        {/if}
        <b class="experience-in">in</b> {location}
    </h2>
    <h3 class="modal-meta">
        {endDate ? `${startDate} - ${endDate}` : startDate}
    </h3>
    <ul class="modal-description">
        {#each bullets as bullet}
            <li>{bullet}</li>
        {/each}
    </ul>
</div>

<style>
    :global(.experience-modal) {
        color: black;
    }

    /* The "in" word between company + location uses --paragraph-colour so
       it visually fades against the bolder company/location text. */
    :global(.experience-modal .experience-in) {
        color: var(--paragraph-colour);
        font-weight: 300;
    }
</style>
