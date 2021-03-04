<script>
    export let position;
    export let company;
    export let companyLink;
    export let startDate;
    export let endDate;
    export let location;
    export let description;
</script>

<div class="experience-modal">
    <h1 class="modal-position" style="text-align: center;">{position}</h1>
    <h2 class="modal-company"><a href={companyLink} rel="noreferrer" target="_blank">{company} </a><b style="color: var(--paragraph-colour); font-weight: 300">in</b> {location}</h2>
    {#if endDate}
        <h3 class="modal-description" style="text-align: center">{startDate}-{endDate}</h3>
    {:else}
        <h3 class="modal-description" style="text-align: center">{startDate}</h3>
    {/if}
    <p class="modal-description">{@html description}</p>
</div>

<style>
    .experience-modal {
        color: black;
    }

    .modal-position {
        font-size: 35px;
        margin: 15px 15px 10px 15px;
        color: var(--modal-title-colour);
    }

    .modal-company {
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

    .modal-company a {
        color: var(--modal-link-colour);
    }

    .modal-company a:hover {
        color: var(--link-hover-colour);
    }

    .modal-description {
        margin: 8px auto 10px auto;
        color: var(--modal-text-colour);
        line-height: 1.4;
    }
</style>