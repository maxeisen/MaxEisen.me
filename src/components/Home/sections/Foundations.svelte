<script>
    import Section from '../../../lib/ui/Section.svelte';
    import TimelineRow from '../../../lib/ui/TimelineRow.svelte';
    import { getContext } from 'svelte';
    import EducationModal from '../modals/EducationModal.svelte';
    import education from '@content/education.json';

    const { open } = getContext('simple-modal');

    const educationModal = (school, location, degree, major, years, courses, committees) => {
        open(EducationModal, {
            school: school, location: location, degree: degree, major: major, years: years, courses: courses, committees: committees
        });
    };
</script>

<Section title="Education" id="foundations">
    <TimelineRow
        when={education[0].years}
        title={education[0].school}
        desc={`${education[0].degreeShort}, ${education[0].majorShort}`}
        onclick={() => educationModal(education[0].school, education[0].location, education[0].degreeLong, education[0].majorLong, education[0].years, education[0].courses, education[0].committees)}
    />
</Section>
