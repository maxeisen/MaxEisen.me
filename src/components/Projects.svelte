<script>
    import { getContext } from 'svelte';
    import ProjectModal from './modals/ProjectModal.svelte';
    
    const { open } = getContext('simple-modal');

    const modal1 = () => {
        open(ProjectModal, {
            name: proj1.name, technologies: proj1.technologies, year: proj1.year, description: proj1.longDescription, githubLink: proj1.githubLink, projectLink: proj1.projectLink, screenshot: proj1.screenshot
        });
    };
    const modal2 = () => {
        open(ProjectModal, {
            name: proj2.name, technologies: proj2.technologies, year: proj2.year, description: proj2.longDescription, githubLink: proj2.githubLink, projectLink: proj2.projectLink, screenshot: proj2.screenshot
        });
    };
    const modal3 = () => {
        open(ProjectModal, {
            name: proj3.name, technologies: proj3.technologies, year: proj3.year, description: proj3.longDescription, githubLink: proj3.githubLink, projectLink: proj3.projectLink, screenshot: proj3.screenshot
        });
    };
    const modal4 = () => {
        open(ProjectModal, {
            name: proj4.name, technologies: proj4.technologies, year: proj4.year, description: proj4.longDescription, githubLink: proj4.githubLink, projectLink: proj4.projectLink, screenshot: proj4.screenshot
        });
    };
    const modal5 = () => {
        open(ProjectModal, {
            name: proj5.name, technologies: proj5.technologies, year: proj5.year, description: proj5.longDescription, githubLink: proj5.githubLink, projectLink: proj5.projectLink, screenshot: proj5.screenshot
        });
    };
    const modal6 = () => {
        open(ProjectModal, {
            name: proj6.name, technologies: proj6.technologies, year: proj6.year, description: proj6.longDescription, githubLink: proj6.githubLink, projectLink: proj6.projectLink, screenshot: proj6.screenshot
        });
    };

    const proj1 = {
        modalFunction: modal1,
        name: "MaxEisen.me",
        emoji: "&#128587;",
        technologies: "Svelte, Netlify, HTML5, CSS3",
        year: "2020",
        shortDescription: "My personal portfolio website (the one you're currently on) built from scratch",
        longDescription:
        `<ul>
            <li>A personal portfolio website built from scratch to showcase my work experience, projects, skills, and more</li>
            <li>Initally a web version of my resume, this became a larger project that constantly allows me to improve my design and development skills</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/MaxEisen.me",
        screenshot: "./img/screenshots/maxeisenme",
    };
    const proj2 = {
        modalFunction: modal2,
        name: "Studii",
        emoji: "&#128218;",
        technologies: "React, Django, MongoDB, HTML5, CSS3",
        year: "2019/2020",
        shortDescription: "A collaborative, all-in-one study space made for students, by students",
        longDescription:
        `<ul>
            <li>For students who can't find a study method that works for them and/or don't have classmates to study with, Studii offers real-time, affordable, peer and tutor support through a tailored forum</li>
            <li>Ideated, developed, marketed, and pitched by a super team of 8 QTMA team members</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/studii_public",
        projectLink: "https://qtma.ca/studii.html",
        screenshot: "./img/screenshots/studii",
    };
    const proj3 = {
        modalFunction: modal3,
        name: "QHacks",
        emoji: "&#128187;",
        technologies: "React, Gatsby, MongoDB, HTML5, CSS3",
        year: "2019/2020",
        shortDescription: "The official website for Queen's University's 2020 MLH hackathon",
        longDescription:
        `<ul>
            <li>The static website for Queen's University's official 2020 hackathon, developed with React and generated using Gatsby</li>
            <li>Accessed thousands of times during the application phase (700+ applicants), as well as leading up to the event</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/qhacks-website/tree/dev-2020",
        projectLink: "https://2020.qhacks.io",
        screenshot: "./img/screenshots/qhacks",
    };
    const proj4 = {
        modalFunction: modal4,
        name: "Spotilizer",
        emoji: "&#127925;",
        technologies: "Python, Tkinter, Spotify Web API",
        year: "2019",
        shortDescription: "A customizable, data-centric Spotify music visualizer built in Python",
        longDescription:
        `<ul>
            <li>Spotilizer is a visualizer that links to a user's Spotify account and uses hundreds of data points from <a href=\"https://developer.spotify.com/documentation/web-api/\" rel=\"noreferrer\" target=\"_blank\">Spotify's Web API</a> to generate visuals according to rhythm, energy, 'danceability', and many other factors</li>
            <li>Developed by a team of 4 in 10 hours, winning 2nd place at Queen's University during MLH's 2019 Local Hack Day</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/spotilizer",
        screenshot: "./img/screenshots/spotilizer",
    };
    const proj5 = {
        modalFunction: modal5,
        name: "Glitch",
        emoji: "&#127918;",
        technologies: "Unity Game Engine, C#",
        year: "2018/2019",
        shortDescription: "A unique, monochromatic platformer game for observant minimalists",
        longDescription:
        `<ul>
            <li>Glitch is a monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li>
            <li>Developed by a group of 3 as a final course project for CISC 226 (Game Design) at Queen's University</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/Glitch",
        projectLink: "https://tamirarnesty.github.io/glitchGame/",
        screenshot: "./img/screenshots/glitch",
    };
    const proj6 = {
        modalFunction: modal6,
        name: "TicTacToe",
        emoji: "&#10060;",
        technologies: "Python",
        year: "2017",
        shortDescription: "A basic, text-based, Pythonic version of tic-tac-toe made in under an hour",
        longDescription:
        `<ul>
            <li>An extremely basic, text-based version of tic-tac-toe made out of boredom on a flight</li>
            <li>Developed in under an hour on a long flight, without access to any online resources</li>
            <li>Initially written in Python 2 and ported to Python 3</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/TicTacToe",
        screenshot: "./img/screenshots/tictactoe",
    };

    var projects = [];
    projects.push(proj1);
    projects.push(proj2);
    projects.push(proj3);
    projects.push(proj4);
    projects.push(proj5);
    projects.push(proj6);

</script>

<h1 class="section-title" id="projects">Projects</h1>
<div class="project-subsection">
    {#each projects as proj}
        <div class="project-item" tabindex="0" style="background-image: url('{proj.screenshot}.webp')" on:click={proj.modalFunction}>
            <h2 class="project-name">{proj.name} {@html proj.emoji}</h2>
            <h2 class="project-year">{proj.year}</h2>
            <h2 class="project-tech">{proj.technologies}</h2>
            <p>{proj.shortDescription}</p>
        </div>
	{/each}
</div>

<style>
    .project-name {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 30px;
    }

    .project-year {
        font-size: 25px;
        font-weight: 300;
        margin: 5px auto 5px auto;
        color: var(--item-subtitle);
    }

    .project-tech {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 18px;
        color: var(--item-small-text);
        font-weight: 300;
    }
</style>