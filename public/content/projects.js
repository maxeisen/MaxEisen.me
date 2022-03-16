export const projects = 
[
    {
        name: "PupBot",
        emoji: "&#128054;",
        technologies: "Python, Matplotlib, Selenium, Twitter API, Twilio API, Heroku",
        year: "2021-Present",
        shortDescription: "A Twitter and Twilio bot tweeting hourly price updates of an ETH-based altcoin",
        longDescription:
        `<ul>
            <li>A bot developed from scratch to fetch and post hourly price "pupdates" for Puppy Coin, a community-driven, Ethereum-based altcoin</li>
            <li>Selenium and CryptoCompare API fetch Puppy Coin and Ethereum prices</li>
            <li>Matplotlib generates beautiful 12-hour price charts</li>
            <li>On the hour, Twitter and Twilio APIs tweet updates and send position values to specified Twitter users and phone numbers</li>
            <li>Deployed to Heroku and scheduled to run each hour</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/pup-bot",
        projectLink: "https://twitter.com/PuppyCoinBot",
        screenshot: "./img/screenshots/pupbot",
    },
    {
        name: "Eagle",
        emoji: "&#129413;",
        technologies: "React Native, Firebase, Netlify",
        year: "2020-2021",
        shortDescription: "A delivery service comparison platform to help food-lovers get the best deal",
        longDescription:
        `<ul>
            <li>A mobile application to help users compare pricing, delivery times, and reviews of the same restaurant across four different delivery services</li>
            <li>Ideated, developed, marketed, and pitched by an awesome team of 10 QTMA team members under my guidance as product manager</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/eagle_public",
        screenshot: "./img/screenshots/eagle",
    },
    {
        name: "MaxEisen.me",
        emoji: "&#128587;&#8205;&#9794;&#65039;",
        technologies: "Svelte, Netlify, HTML5, CSS3",
        year: "2020-Present",
        shortDescription: "My personal portfolio website (the one you're currently on), developed from scratch",
        longDescription:
        `<ul>
            <li>A personal portfolio website built from scratch to showcase my work experience, projects, skills, and more</li>
            <li>Initally a web version of my resume, this became a larger project that constantly allows me to improve my design and development skills</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/MaxEisen.me",
        screenshot: "./img/screenshots/maxeisenme",
    },
    {
        name: "Studii",
        emoji: "&#128218;",
        technologies: "React, Django, MongoDB, HTML5, CSS3",
        year: "2019-2020",
        shortDescription: "A collaborative, all-in-one study space made for students, by students",
        longDescription:
        `<ul>
            <li>For students who can't find a study method that works for them and/or don't have classmates to study with, Studii offers real-time, affordable, peer and tutor support through a tailored forum</li>
            <li>Ideated, developed, marketed, and pitched by a super team of 8 QTMA team members</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/studii_public",
        projectLink: "https://qtma.ca/studii.html",
        screenshot: "./img/screenshots/studii",
    },
    {
        name: "QHacks",
        emoji: "&#128187;",
        technologies: "React, Gatsby, MongoDB, HTML5, CSS3",
        year: "2019-2020",
        shortDescription: "The official website for Queen's University's 2020 MLH hackathon",
        longDescription:
        `<ul>
            <li>The static website for Queen's University's official 2020 hackathon, developed with React and generated using Gatsby</li>
            <li>Accessed thousands of times during the application phase (700+ applicants), as well as leading up to the event</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/qhacks-website/tree/dev-2020",
        projectLink: "https://2020.qhacks.io",
        screenshot: "./img/screenshots/qhacks",
    },
    {
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
    },
    {
        name: "Glitch",
        emoji: "&#127918;",
        technologies: "Unity Game Engine, C#",
        year: "2018-2019",
        shortDescription: "A unique, monochromatic platformer game for observant minimalists",
        longDescription:
        `<ul>
            <li>Glitch is a monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li>
            <li>Developed by a group of 3 as a final course project for CISC 226 (Game Design) at Queen's University</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/Glitch",
        projectLink: "https://tamirarnesty.github.io/glitchGame/",
        screenshot: "./img/screenshots/glitch",
    },
    {
        name: "TicTacToe",
        emoji: "&#10060;",
        technologies: "Python",
        year: "2017",
        shortDescription: "A basic, text-based, Pythonic version of tic-tac-toe made in under an hour",
        longDescription:
        `<ul>
            <li>An extremely basic, text-based version of tic-tac-toe</li>
            <li>One of my earliest coding projects, developed in about an hour on a flight without access to any online resources</li>
            <li>Initially written in Python 2 and ported to Python 3</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/TicTacToe",
        screenshot: "./img/screenshots/tictactoe",
    }
]