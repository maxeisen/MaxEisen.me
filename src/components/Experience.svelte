<script>
    import { getContext } from 'svelte';
    import ExperienceModal from './modals/ExperienceModal.svelte';

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

    const exp1 = {
        modalFunction: modal1,
        shortPosition: "Software Engineer",
        position: "Software Development Engineer",
        shortCompany: "Publicis Sapient",
        company: "Publicis Sapient",
        companyLink: "https://www.publicissapient.com/",
        shortDate: "June 2021",
        startDate: "Starting June 2021",
        location: "Toronto, ON",
        shortDescription: "Working as a software consultant and engineer to create digital experiences for companies around the globe",
        longDescription:
        `<ul>
            <li>Consulting with client companies to determine requirements for large-scale digital transformation projects</li>
            <li>Collaborating with a team to design, develop, and engineer these projects for launch</li>
            <li>Publicis Sapient operates in 20 different countries around the world, giving me the opportunity to work with clients from across the globe</li>
        </ul>`
    };
    const exp2 = {
        modalFunction: modal2,
        position: "Product Manager",
        shortCompany: "QTMA",
        company: "Queen's Technology and Media Association",
        companyLink: "https://qtma.ca/",
        shortDate: "April 2020-Present",
        startDate: "April 2020",
        endDate: "Present",
        location: "Kingston, ON",
        shortDescription: "Managing a talented team of Queen's students to ideate, develop, and market a software product",
        longDescription:
        `<ul>
            <li>Managing a team of talented developers and business analysts to ideate, build, and market a software product</li>
            <li>Leading team presentations and product pitches to students, professors, and potential investors throughout the school year</li>
        </ul>`
    };
    const exp3 = {
        modalFunction: modal3,
        shortPosition: "CS Teaching Assistant",
        position: "Computer Science Teaching Assistant",
        shortCompany: "Queen's University",
        company: "Queen's University",
        shortDate: "Sept. 2019-Present",
        companyLink: "https://cs.queensu.ca/",
        startDate: "September 2019",
        endDate: "Present",
        location: "Kingston, ON",
        shortDescription: "Assisting in the teaching and grading of several intermediate to advanced programming courses",
        longDescription:
        `<ul>
            <li>Selected as one of 3 TAs to assist in teaching and grading of CMPE 212 - Object-Oriented Programming in Java, having previously obtained an exceptional grade in the course</li>
            <li>Holding weekly office hours to guide students in completing assignments and projects</li>
            <li>Previously assisted in the teaching of Fundamentals of Software Development (Agile Methodologies) in C++, and a 250-student Python course</li>
        </ul>`
    };
    const exp4 = {
        modalFunction: modal4,
        shortPosition: "Technical Developer",
        position: "Technical Developer Co-op",
        shortCompany: "Jonah Group",
        company: "Jonah Group",
        companyLink: "https://www.jonahgroup.com/",
        shortDate: "May-Sept. 2020",
        startDate: "May",
        endDate: "September 2020",
        location: "Toronto, ON",
        shortDescription: "Worked with a fantastic team of developers to create large-scale software products for companies",
        longDescription:
        `<ul>
            <li>Used React, Spring Boot, and Postgres in my summer internship to build custom, high-performance software for companies</li>
            <li>Full stack developer on an agile team, developing a decision engine to be implemented for client companies</li>
        </ul>`
    };
    const exp5 = {
        modalFunction: modal5,
        shortPosition: "Director of Technology",
        position: "Founder, Director of Technology",
        shortCompany: "TechTrainers",
        company: "TechTrainers",
        companyLink: "https://techtrainers.ca/",
        shortDate: "May 2019-Jan. 2021",
        startDate: "May 2019",
        endDate: "January 2021",
        location: "Toronto, ON",
        shortDescription: "Creating a network of in-person and online quality tech help and tutoring around the GTA",
        longDescription:
        `<ul>
            <li>Co-founded technology help company, providing tech tutoring and support to 20+ customers in the first 3 months of operation across Toronto</li>
            <li>Overseeing all technical aspects of operations, including web development, database management, and session scheduling</li>
            <li>Company was able to turn a profit in first month of operations</li>
        </ul>`
    };
    const exp6 = {
        modalFunction: modal6,
        shortPosition: "Software Developer",
        position: "Software Developer, Technical Coordinator",
        company: "QHacks",
        companyLink: "https://qhacks.io/",
        shortDate: "Sept. 2019-Feb. 2020",
        startDate: "September 2019",
        endDate: "February 2020",
        location: "Kingston, ON",
        shortDescription: "Developed the website and other software for Queen's University's official MLH hackathon",
        longDescription:
        `<ul>
            <li>Developed and deployed the official website for the 2020 MLH-affiliated hackathon using React and Gatsby (accessed by over 10,000 individuals)</li>
            <li>Worked on digital dashboard for use by 700+ applicants in time leading up to, and during event</li>
            <li>Oversaw technology operations during the hackathon, helping teams in completing their projects, and keeping all information up-to-date</li>
        </ul>`
    };

    var experiences = [];
    experiences.push(exp1);
    experiences.push(exp2);
    experiences.push(exp3);
    experiences.push(exp4);
    experiences.push(exp5);
    experiences.push(exp6);

</script>

<h1 class="section-title" id="experience">Experience</h1>
<div class="experience-subsection">
    {#each experiences as exp}
		<div class="experience-item" tabindex="0" on:click={exp.modalFunction}>
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
