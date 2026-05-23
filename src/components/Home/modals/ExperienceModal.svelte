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
    <h1 class="modal-position" style="text-align: center;">{position}</h1>
    <h2 class="modal-company">
        {#if companyLink}
            <a href="{companyLink}" rel="noreferrer" target="_blank">{company} </a>
        {:else}
            {company}
        {/if}
        <b style="color: var(--paragraph-colour); font-weight: 300">in</b> {location}
    </h2>
    {#if endDate}
        <h3 class="modal-description" style="text-align: center">{startDate} - {endDate}</h3>
    {:else}
        <h3 class="modal-description" style="text-align: center">{startDate}</h3>
    {/if}
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

    :global(.experience-modal .modal-position) {
        font-size: 35px;
        margin: 15px 15px 10px 15px;
        color: var(--modal-title-colour);
        font-family: 'Fraunces', 'Iowan Old Style', 'Times New Roman', serif;
        font-weight: 600;
        font-optical-sizing: auto;
        letter-spacing: -0.02em;
    }

    :global(.experience-modal .modal-company) {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: var(--paragraph-colour);
        font-size: 25px;
        margin-top: 5px;
        margin-bottom: 5px;
        text-align: center;
    }

    :global(.experience-modal .modal-company a) {
        color: var(--modal-link-colour);
    }

    :global(.experience-modal .modal-company a:hover) {
        color: var(--link-hover-colour);
    }

    :global(.experience-modal .modal-description) {
        margin: 8px auto 10px auto;
        color: var(--modal-text-colour);
        line-height: 1.6;
    }

    :global(.experience-modal ul.modal-description li) {
        margin-bottom: 10px;
    }

    :global(.experience-modal ul.modal-description li:last-child) {
        margin-bottom: 0;
    }
</style>