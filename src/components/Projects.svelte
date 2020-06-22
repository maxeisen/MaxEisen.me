<script>
    import { getContext } from 'svelte';
    import ProjectModal from './ProjectModal.svelte';

    const proj1 = {
        name: "Studii",
        emoji: "&#128218;",
        technologies: "React, Django, MongoDB",
        year: "2019/2020",
        shortDescription: "A collaborative study space for students, by students",
        longDescription: "<ul><li>For students who can't find a study method that works for them and/or don't have classmates to study with, Studii offers real-time, affordable, peer and tutor support through a tailored forum</li><li>Ideated, developed, marketed, and pitched by myself and my 7 other QTMA team members</li></ul>",
        githubLink: "https://github.com/maxeisen/studii_public",
        projectLink: "https://qtma.ca/studii.html",
        screenshot: "./img/screenshots/studii.jpg",
    };
    const proj2 = {
        name: "QHacks Website",
        emoji: "&#128187;",
        technologies: "React, Gatsby, MongoDB",
        year: "2019/2020",
        shortDescription: "The official website for Queen's University's 2020 MLH hackathon",
        longDescription: "<ul><li>The static website for the 2020 hackathon, developed with React and generated using Gatsby, as well as the dashboard with a MongoDB backend</li><li>Accessed thousands of times during the application phase (700+ applicants), as well as leading up to the event</li></ul>",
        githubLink: "https://github.com/maxeisen/qhacks-website/tree/dev-2020",
        projectLink: "https://qhacks.io",
        screenshot: "./img/screenshots/qhacks.jpg",
    };
    const proj3 = {
        name: "Spotilizer",
        emoji: "&#127925;",
        technologies: "Python, Tkinter, Spotify Web API",
        year: "2019",
        shortDescription: "A customizable, data-centric Spotify visualizer built in Python",
        longDescription: "<ul><li>Spotilizer is a visualizer that links to a user's Spotify account and uses hundreds of data points from <a href=\"https://developer.spotify.com/documentation/web-api/\" target=\"_blank\">Spotify's Web API</a> to generate visuals according to rhythm, energy, 'danceability', and many other factors</li><li>Developed by a team of 4 in 10 hours, winning 2nd place at Queen's University during MLH's 2019 Local Hack Day</li></ul>",
        githubLink: "https://github.com/maxeisen/spotilizer",
        projectLink: "https://github.com/maxeisen/spotilizer",
        screenshot: "./img/screenshots/spotilizer.jpg",
    };
    const proj4 = {
        name: "Glitch",
        emoji: "&#127918;",
        technologies: "Unity Game Engine, C#",
        year: "2018/2019",
        shortDescription: "A unique, monochromatic platformer game for observant minimalists",
        longDescription: "<ul><li>Glitch is a monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li><li>The player will have to use this mechanic in order to complete the game's levels, allowing them to switch between the level’s two states and see certain elements that were not previously visible</li><li>Developed as a group project for CISC 226 - Game Design at Queen's University</li></ul>",
        githubLink: "https://github.com/maxeisen/Glitch",
        projectLink: "https://tamirarnesty.github.io/glitchGame/",
        screenshot: "./img/screenshots/glitch.jpg",
    };

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
</script>

<h1 class="section-title" id="projects">Projects</h1>
<div class="project-subsection">
    <div class="project-item" on:click={modal1}>
        <h2 class="project-name">{proj1.name} {@html proj1.emoji}</h2>
        <h2 class="project-year">{proj1.year}</h2>
        <h2 class="project-tech">{proj1.technologies}</h2>
        <p>{proj1.shortDescription}</p>
    </div>
    <div class="project-item" on:click={modal2}>
        <h2 class="project-name">{proj2.name} {@html proj2.emoji}</h2>
        <h2 class="project-year">{proj2.year}</h2>
        <h2 class="project-tech">{proj2.technologies}</h2>
        <p>{proj2.shortDescription}</p>
    </div>
    <div class="project-item" on:click={modal3}>
        <h2 class="project-name">{proj3.name} {@html proj3.emoji}</h2>
        <h2 class="project-year">{proj3.year}</h2>
        <h2 class="project-tech">{proj3.technologies}</h2>
        <p>{proj3.shortDescription}</p>
    </div>
    <div class="project-item" on:click={modal4}>
        <h2 class="project-name">{proj4.name} {@html proj4.emoji}</h2>
        <h2 class="project-year">{proj4.year}</h2>
        <h2 class="project-tech">{proj4.technologies}</h2>
        <p>{proj4.shortDescription}</p>
    </div>
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
        color: rgb(194, 194, 194);
    }

    .project-tech {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 18px;
        color: rgb(173, 173, 173);
        font-weight: 300;
    }
</style>