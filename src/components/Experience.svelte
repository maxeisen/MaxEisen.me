<script>
    import { getContext } from 'svelte';
    import ExperienceModal from './modals/ExperienceModal.svelte';
    import { experience } from '../../public/content/experience.js';

    const { open } = getContext('simple-modal');

    const experienceModal = (position, company, companyLink, startDate, endDate, location, description) => {
        open(ExperienceModal, {
            position: position, company: company, companyLink: companyLink, startDate: startDate, endDate: endDate, location: location, description: description
        });
    };

</script>

<h1 class="section-title" id="experience" style="text-align: left;">Experience</h1>
<div class="experience-subsection">
    {#each experience as exp}
		<div class="experience-item" tabindex="0"
        on:click={() => experienceModal(exp.position, exp.company, exp.companyLink, exp.startDate, exp.endDate, exp.location, exp.longDescription)}>
            {#if exp.shortPosition}
                <h2 class="experience-title"><div class="experience-position">{exp.shortPosition}</div></h2>
            {:else}
                <h2 class="experience-title"><div class="experience-position">{exp.position}</div></h2>
            {/if}
            {#if exp.shortCompany}
                <h2 class="experience-company">{exp.shortCompany}</h2>
            {:else}
                <h2 class="experience-company">{exp.company}</h2>
            {/if}
            <p>{exp.shortDescription}</p>
            <h1 class="experience-date-location"><div class="experience-date">{exp.shortDate}</div><div class="experience-location">{exp.location}</div></h1>
        </div>
	{/each}
</div>

<style>
    .experience-title {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 25px;
    }

    .experience-position {
        display: inline-block;
    }

    .experience-company {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 22px;
        color: var(--item-subtitle);
        font-weight: 300;
    }

    .experience-date-location {
        font-weight: 300;
        text-align: left;
        font-size: 15px;
    }

    .experience-date {
        color: var(--item-small-text);
        display: inline-block;
    }

    .experience-location {
        color: var(--item-small-text);
        float: right;
    }
</style>
