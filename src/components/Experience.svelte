<script>
    import { getContext } from 'svelte';
    import ExperienceModal from './ExperienceModal.svelte';

    const exp1 = {
        position: "Technical Developer",
        company: "Jonah Group",
        companyLink: "https://www.jonahgroup.com/",
        startDate: "May 2020",
        endDate: "Present",
        location: "Toronto, ON",
        shortDescription: "Working with a fantastic team of developers to create great web apps",
        longDescription: `<ul><li>Working with a fantastic team of developers to create great web apps</li></ul>`
    }
    const exp2 = {
        position: "Product Manager",
        company: "Queen's Technology and Media Association",
        companyLink: "https://qtma.ca/",
        startDate: "April 2020",
        endDate: "Present",
        location: "Kingston, ON",
        shortDescription: "Managing a talented team of Queen's students to ideate, develop, and market a software product",
        longDescription: `<ul><li>Managing a team of developers and business analysts to ideate, build, and market a software product</li><li>Leading team presentations and product pitches throughout the school year</li></ul>`
    }
    const exp3 = {
        position: "Co-Founder, Lead Trainer",
        company: "TechTrainers",
        companyLink: "https://techtrainers.ca/",
        startDate: "May 2019",
        endDate: "Present",
        location: "Toronto, ON",
        shortDescription: "Providing quality tech help and tutoring around the GTA",
        longDescription: `<ul><li>Co-founded technology help company, providing tech tutoring and support to 20+ customers in the first 3 months of operation across the Greater Toronto Area</li><li>Company was able to turn a profit in first month</li></ul>`
    }
    const exp4 = {
        position: "CS Teaching Assistant",
        company: "Queen's University",
        companyLink: "https://cs.queensu.ca/",
        startDate: "September 2019",
        endDate: "April 2020",
        location: "Kingston, ON",
        shortDescription: "Worked as a teaching assistant for a Python programming course of over 250 students",
        longDescription: `<ul><li>Selected as one of 8 TAs for the specific Python programming course, having previously obtained an exceptional grade</li><li>Assisted in the teaching and grading of the class with over 250 students</li></ul>`
    }
    const exp5 = {
        position: "Software Developer",
        company: "QHacks",
        companyLink: "https://qhacks.io/",
        startDate: "September 2019",
        endDate: "February 2020",
        location: "Kingston, ON",
        shortDescription: "Developed the website and other software for Queen's University's official MLH hackathon",
        longDescription: `<ul><li>Used React (JavaScript library) to develop frontend of the website for the MLH-affiliated hackathon</li><li>Worked on digital dashboard for use by 700+ individuals in time leading up to and during event</li></ul>`
    }
    const exp6 = {
        position: "Technical Instructor",
        company: "UnderTheGUI Inc.",
        companyLink: "https://underthegui.com/",
        startDate: "May",
        endDate: "August 2019",
        location: "Vancouver, BC",
        shortDescription: "Taught and created course content for programming and engineering courses",
        longDescription: `<ul><li>Instructed and evaluated 50 individual students through 6-week summer program revolving around early introduction to engineering and programming concepts</li></ul>`
    }

    const { open } = getContext('simple-modal');

    const modal1 = () => {
        open(ExperienceModal, {
            position: exp1.position, company: exp1.company, companyLink: exp1.companyLink, startDate: exp1.startDate, endDate: exp1.endDate, location: exp1.location, description: exp1.longDescription
        });
    };
    const modal2 = () => {
        open(ExperienceModal, {
            position: exp2.position, company: exp2.company, companyLink: exp2.companyLink, startDate: exp2.startDate, endDate: exp2.endDate, location: exp2.location, description: exp2.longDescription
        });
    };
    const modal3 = () => {
        open(ExperienceModal, {
            position: exp3.position, company: exp3.company, companyLink: exp3.companyLink, startDate: exp3.startDate, endDate: exp3.endDate, location: exp3.location, description: exp3.longDescription
        });
    };
    const modal4 = () => {
        open(ExperienceModal, {
            position: exp4.position, company: exp4.company, companyLink: exp4.companyLink, startDate: exp4.startDate, endDate: exp4.endDate, location: exp4.location, description: exp4.longDescription
        });
    };
    const modal5 = () => {
        open(ExperienceModal, {
            position: exp5.position, company: exp5.company, companyLink: exp5.companyLink, startDate: exp5.startDate, endDate: exp5.endDate, location: exp5.location, description: exp5.longDescription
        });
    };
    const modal6 = () => {
        open(ExperienceModal, {
            position: exp6.position, company: exp6.company, companyLink: exp6.companyLink, startDate: exp6.startDate, endDate: exp6.endDate, location: exp6.location, description: exp6.longDescription
        });
    };
</script>

<html lang="en">
    <h1 class="section-title" id="experience">Experience</h1>
    <div class="experience-subsection">
        <div class="experience-item" on:click={modal1}>
            <h2 class="experience-title"><div class="experience-position">{exp1.position}</div></h2>
            <h2 class="experience-title">{exp1.company}</h2>
            <h1 class="experience-date-location"><div class="experience-date">{exp1.startDate}<b style="color:gray">-</b>{exp1.endDate}</div><div class="experience-location">{exp1.location}</div></h1>
        </div>
        <div class="experience-item" on:click={modal2}>
            <h2 class="experience-title"><div class="experience-position">{exp2.position}</div></h2>
            <h2 class="experience-title">QTMA</h2>
            <h1 class="experience-date-location"><div class="experience-date">{exp2.startDate}<b style="color:gray">-</b>{exp2.endDate}</div><div class="experience-location">{exp2.location}</div></h1>
        </div>
        <div class="experience-item" on:click={modal3}>
            <h2 class="experience-title"><div class="experience-position">{exp3.position}</div></h2>
            <h2 class="experience-title">{exp3.company}</h2>
            <h1 class="experience-date-location"><div class="experience-date">{exp3.startDate}<b style="color:gray">-</b>{exp3.endDate}</div><div class="experience-location">{exp3.location}</div></h1>
        </div>
        <div class="experience-item" on:click={modal4}>
            <h2 class="experience-title"><div class="experience-position">{exp4.position}</div></h2>
            <h2 class="experience-title">{exp4.company}</h2>
            <h1 class="experience-date-location"><div class="experience-date">{exp4.startDate}<b style="color:gray">-</b>{exp4.endDate}</div>
            <div class="experience-location">{exp4.location}</div></h1>
        </div>
        <div class="experience-item" on:click={modal5}>
            <h2 class="experience-title"><div class="experience-position">{exp5.position}</div></h2>
            <h2 class="experience-title">{exp5.company}</h2>
            <h1 class="experience-date-location"><div class="experience-date">{exp5.startDate}<b style="color:gray">-</b>{exp5.endDate}</div><div class="experience-location">{exp5.location}</div></h1>
        </div>
        <div class="experience-item" on:click={modal6}>
            <h2 class="experience-title"><div class="experience-position">{exp6.position}</div></h2>
            <h2 class="experience-title">{exp6.company}</h2>
            <h1 class="experience-date-location"><div class="experience-date">{exp6.startDate}<b style="color:gray">-</b>{exp6.endDate}</div><div class="experience-location">{exp6.location}</div></h1>
        </div>
    </div>
</html>