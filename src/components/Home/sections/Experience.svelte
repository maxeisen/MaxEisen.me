<script>
    import { getContext } from 'svelte';
    import ExperienceModal from '../modals/ExperienceModal.svelte';
    import experience from '@content/experience.json';
    import Section from '../../../lib/ui/Section.svelte';
    import Tag from '../../../lib/ui/Tag.svelte';
    import TimelineRow from '../../../lib/ui/TimelineRow.svelte';

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

    const formatDateRange = (startDate, endDate) => `${shortenDate(startDate)} – ${shortenDate(endDate)}`;

    const isCurrent = (exp) => exp.endDate === 'Present';
    const sortedExperience = [...experience].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)));
</script>

<Section title="Experience" id="experience">
    <ul class="list">
        {#each sortedExperience as exp}
            <li>
                <TimelineRow
                    when={formatDateRange(exp.startDate, exp.endDate)}
                    title={exp.shortPosition || exp.position}
                    at={exp.shortCompany || exp.company}
                    desc={exp.shortDescription}
                    meta={exp.location}
                    onclick={() => experienceModal(exp.position, exp.company, exp.companyLink, exp.startDate, exp.endDate, exp.location, exp.bullets)}
                >
                    {#snippet badge()}
                        {#if isCurrent(exp)}<Tag tone="accent">Current</Tag>{/if}
                    {/snippet}
                </TimelineRow>
            </li>
        {/each}
    </ul>
</Section>

<style>
    .list { list-style: none; margin: 0; padding: 0; }
</style>
