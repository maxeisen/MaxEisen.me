<script>
    import { getContext } from 'svelte';
    import ExperienceModal from './modals/ExperienceModal.svelte';
    import experience from '@content/experience.json';
    import { tilt } from '../lib/tilt.js';

    const { open } = getContext('simple-modal');

    const experienceModal = (position, company, companyLink, startDate, endDate, location, bullets) => {
        open(ExperienceModal, {
            position: position, company: company, companyLink: companyLink, startDate: startDate, endDate: endDate, location: location, bullets: bullets
        });
    };

    const MONTH_ABBR = {
        'January': 'Jan.', 'February': 'Feb.', 'March': 'Mar.', 'April': 'Apr.',
        'May': 'May', 'June': 'Jun.', 'July': 'Jul.', 'August': 'Aug.',
        'September': 'Sep.', 'October': 'Oct.', 'November': 'Nov.', 'December': 'Dec.'
    };

    const shortenDate = (dateStr) => {
        if (dateStr === 'Present') return 'Present';
        const [month, year] = dateStr.split(' ');
        const abbr = MONTH_ABBR[month] ?? month;
        return year ? `${abbr} ${year}` : abbr;
    };

    const formatDateRange = (startDate, endDate) => `${shortenDate(startDate)}-${shortenDate(endDate)}`;

    const isCurrent = (exp) => exp.endDate === 'Present';
    const sortedExperience = [...experience].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)));
</script>

<h1 class="section-title" id="experience" style="text-align: left;">Experience</h1>
<div class="experience-subsection">
    {#each sortedExperience as exp}
		<div class="experience-item {isCurrent(exp) ? 'experience-item--current' : ''}" tabindex="0" use:tilt={{ max: 11, scale: 1.03 }}
        on:click={() => experienceModal(exp.position, exp.company, exp.companyLink, exp.startDate, exp.endDate, exp.location, exp.bullets)}>
            {#if isCurrent(exp)}
                <span class="experience-current-badge" aria-label="Current role">Current</span>
            {/if}
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
            <h1 class="experience-date-location"><div class="experience-date">{formatDateRange(exp.startDate, exp.endDate)}</div><div class="experience-location">{exp.location}</div></h1>
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

    :global(.experience-item--current) {
        grid-column: 1 / -1;
        position: relative;
        border-color: var(--main-green) !important;
        box-shadow: 0 0 0 1px var(--main-green), 0 0 18px var(--main-green-translucent);
        background-image: linear-gradient(135deg, var(--main-green-translucent) 0%, transparent 55%);
    }

    .experience-current-badge {
        position: absolute;
        top: 12px;
        left: 16px;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--main-green);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    @media only screen and (max-width: 620px) {
        .experience-current-badge {
            position: static;
            display: inline-block;
            margin: 4px 0 2px 0;
        }
    }
</style>
