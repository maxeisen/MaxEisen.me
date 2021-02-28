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
    <h1 class="modal-position">{position}</h1>
    <h2 class="modal-company"><a href={companyLink} rel="noreferrer" target="_blank">{company}</a></h2>
    {#if endDate}
        <h3 class="modal-description" style="text-align: center">{startDate}-{endDate}</h3>
    {:else}
        <h3 class="modal-description" style="text-align: center">{startDate}</h3>
    {/if}
    <h3 class="modal-description" style="text-align: center;">{location}</h3>
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
        color: var(--modal-link-colour);
        font-size: 25px;
        margin-top: 5px;
    }

    .modal-company:hover {
        font-size: 25px;
        margin-top: 5px;
    }

    .modal-description {
        margin: 10px auto 10px auto;
        color: var(--modal-text-colour);
        line-height: 1.4;
    }
</style>