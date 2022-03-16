<script>
    import { getContext } from 'svelte';
    import EducationModal from './modals/EducationModal.svelte';
    import { education } from '../../public/content/education.js';

    const { open } = getContext('simple-modal');

    const educationModal = (school, location, degree, major, years, courses, committees) => {
        open(EducationModal, {
            school: school, location: location, degree: degree, major: major, years: years, courses: courses, committees: committees
        });
    };
</script>

<h1 class="section-title" id="education" style="text-align: left;">Education</h1>
<div class="education-subsection">
    <div class="education-item" tabindex="0"
    on:click={() => educationModal(education[0].school, education[0].location, education[0].degreeLong, education[0].majorLong, education[0].years, education[0].courses, education[0].committees)}>
        <h2 class="school-name">{education[0].school}</h2>
        <h2 class="degree-info">{education[0].degreeShort}</h2>
        <h2 class="major-info">{education[0].majorShort}</h2>
        <h2 class="degree-years">{education[0].years}</h2>
    </div>
</div>

<style>
    .school-name {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 30px;
    }

    .degree-info {
        font-size: 20px;
        font-weight: 300;
        margin: 5px auto 5px auto;
        color: var(--item-subtitle);
    }

    .major-info {
        margin: 5px auto 5px auto;
        text-align: center;
        font-size: 18px;
        color: var(--item-small-text);
        font-weight: 300;
    }

    .degree-years {
        font-size: 16px;
        font-weight: 300;
        margin: 5px auto 5px auto;
        color: var(--item-small-text);
    }
</style>