<script>
    import { getContext } from 'svelte';
    import ExperienceModal from './modals/ExperienceModal.svelte';

    const exp1 = {
        position: "Technical Developer",
        company: "Jonah Group",
        companyLink: "https://www.jonahgroup.com/",
        startDate: "May",
        endDate: "September 2020",
        location: "Toronto, ON",
        shortDescription: "Working with a fantastic team of developers to create large-scale software products for companies",
        longDescription: `<ul><li>Using a wide variety of technologies and languages in my summer internship to build custom, high-performance software for companies</li><li>Full stack software engineer in a team of several skilled developers and engineers working on a decision engine to be implemented for client companies</li></ul>`
    };
    const exp2 = {
        position: "Product Manager",
        company: "Queen's Technology and Media Association",
        companyLink: "https://qtma.ca/",
        startDate: "April 2020",
        endDate: "Present",
        location: "Kingston, ON",
        shortDescription: "Managing a talented team of Queen's students to ideate, develop, and market a software product",
        longDescription: `<ul><li>Managing a team of talented developers and business analysts to ideate, build, and market a software product</li><li>Leading team presentations and product pitches to students, professors, and potential investors throughout the school year</li></ul>`
    };
    const exp3 = {
        position: "Computer Science Teaching Assistant",
        company: "Queen's University",
        companyLink: "https://cs.queensu.ca/",
        startDate: "September 2019",
        endDate: "Present",
        location: "Kingston, ON",
        shortDescription: "Assisting in the teaching of Fundamentals of Agile Software Development",
        longDescription: `<ul><li>Selected as one of 8 TAs for CISC 320 - Fundamentals of Software Development (Agile Methodologies) in C++, having previously obtained an exceptional grade in the course</li><li>Holding weekly office hours to guide students in completing assignments and projects</li><li>Previously assisted in the teaching and grading of a 250-student Python course</li></ul>`
    };
    const exp4 = {
        position: "Director of Technology",
        company: "TechTrainers",
        companyLink: "https://techtrainers.ca/",
        startDate: "May 2019",
        endDate: "Present",
        location: "Toronto, ON",
        shortDescription: "Creating a network of in-person and online quality tech help and tutoring around the GTA",
        longDescription: `<ul><li>Co-founded technology help company, providing tech tutoring and support to 20+ customers in the first 3 months of operation across Toronto</li><li>Overseeing all technical aspects of operations, including web development, database management, and session scheduling</li><li>Company was able to turn a profit in first month of operations</li></ul>`
    };
    const exp5 = {
        position: "Software Developer",
        company: "QHacks",
        companyLink: "https://qhacks.io/",
        startDate: "September 2019",
        endDate: "February 2020",
        location: "Kingston, ON",
        shortDescription: "Developed the website and other software for Queen's University's official MLH hackathon",
        longDescription: `<ul><li>Developed and deployed the official website for the 2020 MLH-affiliated hackathon using React and Gatsby (accessed by over 10,000 individuals)</li><li>Worked on digital dashboard for use by 700+ applicants in time leading up to, and during event</li><li>Oversaw technology operations during the hackathon, helping teams in completing their projects, and keeping all information up-to-date</li></ul>`
    };
    const exp6 = {
        position: "Technical Instructor",
        company: "UnderTheGUI Inc.",
        companyLink: "https://underthegui.com/",
        startDate: "May",
        endDate: "August 2019",
        location: "Vancouver, BC",
        shortDescription: "Taught and created course content for programming and engineering courses tailored to teens and young adults",
        longDescription: `<ul><li>Instructed and evaluated 50 individual students through 6-week summer program revolving around early introduction to engineering and programming concepts</li><li>Courses included: Python Game Development, Fundamentals of Engineering, and Arduino C++ Programming</li><li>Created custom course content for organization for use in future years</li></ul>`
    };

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

<h1 class="section-title" id="experience">Experience</h1>
<div class="experience-subsection">
    <div class="experience-item" tabindex="0" on:click={modal1}>
        <h2 class="experience-title"><div class="experience-position">{exp1.position}</div></h2>
        <h2 class="experience-company">{exp1.company}</h2>
        <p>{exp1.shortDescription}</p>
        <h1 class="experience-date-location"><div class="experience-date">{exp1.startDate}-{exp1.endDate}</div><div class="experience-location">{exp1.location}</div></h1>
    </div>
    <div class="experience-item" tabindex="0" on:click={modal2}>
        <h2 class="experience-title"><div class="experience-position">{exp2.position}</div></h2>
        <h2 class="experience-company">QTMA</h2>
        <p>{exp2.shortDescription}</p>
        <h1 class="experience-date-location"><div class="experience-date">{exp2.startDate}-{exp2.endDate}</div><div class="experience-location">{exp2.location}</div></h1>
    </div>
    <div class="experience-item" tabindex="0" on:click={modal3}>
        <h2 class="experience-title"><div class="experience-position">CS Teaching Assistant</div></h2>
        <h2 class="experience-company">{exp3.company}</h2>
        <p>{exp3.shortDescription}</p>
        <h1 class="experience-date-location"><div class="experience-date">{exp3.startDate}-{exp3.endDate}</div><div class="experience-location">{exp3.location}</div></h1>
    </div>
    <div class="experience-item" tabindex="0" on:click={modal4}>
        <h2 class="experience-title"><div class="experience-position">{exp4.position}</div></h2>
        <h2 class="experience-company">{exp4.company}</h2>
        <p>{exp4.shortDescription}</p>
        <h1 class="experience-date-location"><div class="experience-date">Sept. 2019-{exp4.endDate}</div>
        <div class="experience-location">{exp4.location}</div></h1>
    </div>
    <div class="experience-item" tabindex="0" on:click={modal5}>
        <h2 class="experience-title"><div class="experience-position">{exp5.position}</div></h2>
        <h2 class="experience-company">{exp5.company}</h2>
        <p>{exp5.shortDescription}</p>
        <h1 class="experience-date-location"><div class="experience-date">Sept. 2019-Feb. 2020</div><div class="experience-location">{exp5.location}</div></h1>
    </div>
    <div class="experience-item" tabindex="0" on:click={modal6}>
        <h2 class="experience-title"><div class="experience-position">{exp6.position}</div></h2>
        <h2 class="experience-company">{exp6.company}</h2>
        <p>{exp6.shortDescription}</p>
        <h1 class="experience-date-location"><div class="experience-date">{exp6.startDate}-{exp6.endDate}</div><div class="experience-location">{exp6.location}</div></h1>
    </div>
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
        color: rgb(202, 202, 202);
        font-weight: 300;
    }

    .experience-date-location {
        font-weight: 300;
        text-align: left;
        font-size: 15px;
    }

    .experience-date {
        color: rgb(173, 173, 173);
        display: inline-block;
    }

    .experience-location {
        color: rgb(173, 173, 173);
        float: right;
    }
</style>