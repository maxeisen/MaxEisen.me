<script>
    import { getContext } from 'svelte';
    import EducationModal from './EducationModal.svelte';

    const education = {
        school: "Queen's University",
        degree: "Bachelor of Computing (<a href=\"https://www.queensu.ca/admission/programs/computing\">BCmpH</a>)",
        major: "Computer Science (<a href=\"http://www.cips.ca/\">CIPS</a> Accredited)",
        years: "2017 - 2021",
        committees: "QTMA, QHacks, TEDxQueensU, QWEB, Residence Society, Computing DSC, Math DSC, Residence Life Council"
    }

    const { open } = getContext('simple-modal');

    const educationModal = () => {
        open(EducationModal, {
            school: education.school, degree: education.degree, major: education.major, years: education.years, committees: education.committees
        });
    };

</script>

<h1 class="section-title" id="education">Education</h1>
    <div class="education-subsection">
        <div class="education-item" on:click={educationModal}>
            <h2 class="school-name">{education.school}</h2>
            <h2 class="degree-info">Bachelor of Computing (Honours)</h2>
            <h2 class="major-info">Computer Science</h2>
            <h2 class="degree-years">{education.years}</h2>
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
        color: rgb(231, 230, 230);
    }

    .major-info {
        margin: 5px auto 5px auto;
        text-align: center;
        font-size: 18px;
        color: rgb(173, 173, 173);
        font-weight: 300;
    }

    .degree-years {
        font-size: 16px;
        font-weight: 300;
        margin: 5px auto 5px auto;
        color: rgb(194, 194, 194);
    }
</style>