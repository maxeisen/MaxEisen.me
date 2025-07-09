export const projects = 
[
    {
        name: "Convoke",
        emoji: "🤔",
        technologies: "Next.js, OpenAI GPT-3, Vercel",
        year: "2022-Present",
        shortDescription: "A web-based game designed to provoke abstract conversation and deep thought",
        longDescription:
        `<ul>
            <li>A game made as an alternative to many classic social games played over a few drinks, to provoke thought and conversation</li>
            <li>Using <a href=\"https://openai.com/blog/openai-api/\" rel=\"noreferrer\" target=\"_blank\">Open-AI's GPT-3 API</a>, thought-provoking questions are generated each round, posed to your group, and a best response is selected</li>
            <li>Scores are kept track of by the web app and a winner is declared after three rounds</li>
            <li>Alternatively a more personal <a href=\"https://convoke.app/daily\" rel=\"noreferrer\" target=\"_blank\">daily question</a> can be answered by an individual user, with responses saved to local storage</li>
            <li>Developed in two weeks after inspiration struck</li>
            <li>Ranked #7 on launch day on <a href=\"https://www.producthunt.com/posts/convoke\" rel=\"noreferrer\" target=\"_blank\">Product Hunt</a></li>
            <li>Currently closed-source as opportunities for expansion and monetization are explored</li>
        </ul>`,
        projectLink: "https://convoke.app",
        screenshot: "convoke",
    },
    {
        name: "NFTokenator",
        emoji: "&#129689;",
        technologies: "Python, Pillow, NumPy",
        year: "2022-Present",
        shortDescription: "A Python script to programatically generate NFT images from provided assets",
        longDescription:
        `<ul>
            <li>An extensible, easy-to-use, customizable CLI-based NFT generator to create collections as large as allowed for by provided assets</li>
            <li>Tens of thousands of NFT images can be generated in just minutes from specified assets and trait rarities</li>
            <li>Pillow is used to stack layers that are selected at random based on provided weights</li>
            <li>A folder is created containing all generated token images, as well as a file specifying actual occurences of different traits, which can be used to find rarities</li>
            <li>Made to be user-friendly and easily forked with custom validation logic, assets, and traits for any NFT project</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/nftokenator",
        screenshot: "nftokenator",
    },
    {
        name: "WhatToTip",
        emoji: "&#128184;",
        technologies: "Next.js, OpenAI GPT-3, Python, Vercel",
        year: "2022-Present",
        shortDescription: "A web app to helping travellers save money on their next trip",
        longDescription:
        `<ul>
            <li>A minimalistic web app that helps travellers by providing short but informative tips for saving in every country across the globe</li>
            <li>Next.js server-side rendering makes for fast and responsive user interactions and loading of static content</li>
            <li>A Python script was developed to leverage OpenAI's GPT-3 engine to generate tips for every country in our list</li>
            <li>Vercel is used to continously deploy the site from the GitHub repository</li>
            <li>Originally developed to inform travellers on how to tip in different countries around the world, hence the name "WhatToTip"</li>
        </ul>`,
        projectLink: "https://whattotip.in",
        screenshot: "whattotip",
    },
    {
        name: "NuHealth",
        emoji: "&#129659;",
        technologies: "Next.js, Firebase, Vercel",
        year: "2022",
        shortDescription: "A web app to resolve the bottlenecks in Canada's socialized healthcare system",
        longDescription:
        `<ul>
            <li>A dual-purpose web app aimed at helping patient's manage access to their health information, and providing EMTs with crucial medical data</li>
            <li>Next.js server-side rendering allows for quick response times when querying the Firestore database to access patient health information</li>
            <li>Firebase is used to store patient health information and to authenticate EMTs</li>
            <li>Patient's also have the ability to specify who should be able to access their health information</li>
            <li>Built in <48 hours by a team of 4, for the <a href=\"https://publicissapient.com/\" rel=\"noreferrer\" target=\"_blank\">Publicis Sapient</a> Aspire SPEED Hackathon <b>(top 10 finalist)</b></li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/nuhealth_public",
        projectLink: "https://nuhealth.vercel.app",
        screenshot: "nuhealth",
    },
    // {
    //     name: "PupBot",
    //     emoji: "&#128054;",
    //     technologies: "Python, Matplotlib, Selenium, Twitter API, Twilio API, Heroku",
    //     year: "2021-Present",
    //     shortDescription: "A Twitter and Twilio bot tweeting hourly price updates of an ETH-based altcoin",
    //     longDescription:
    //     `<ul>
    //         <li>A bot developed from scratch to fetch and post hourly price "pupdates" for Puppy Coin, a community-driven, Ethereum-based altcoin</li>
    //         <li>Selenium and CryptoCompare API fetch Puppy Coin and Ethereum prices</li>
    //         <li>Matplotlib generates beautiful 12-hour price charts</li>
    //         <li>On the hour, Twitter and Twilio APIs tweet updates and send position values to specified Twitter users and phone numbers</li>
    //         <li>Deployed to Heroku and scheduled to run each hour</li>
    //     </ul>`,
    //     githubLink: "https://github.com/maxeisen/pup-bot",
    //     projectLink: "https://twitter.com/PuppyCoinBot",
    //     screenshot: "pupbot",
    // },
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
        projectLink: "https://www.qtma.ca/product/Eagle",
        screenshot: "eagle",
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
        screenshot: "maxeisenme",
    },
    {
        name: "Studii",
        emoji: "&#128218;",
        technologies: "React, Django, MongoDB, HTML5, CSS3",
        year: "2019-2020",
        shortDescription: "A collaborative, all-in-one study space made for students, by students",
        longDescription:
        `<ul>
            <li>A real-time, affordable, peer and tutor support forum for students who can't find a study method that works for them and/or don't have classmates to study with</li>
            <li>Ideated, developed, marketed, and pitched by a super team of 8 QTMA team members</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/studii_public",
        projectLink: "https://www.qtma.ca/product/Studii",
        screenshot: "studii",
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
        projectLink: "https://qhacks.io",
        screenshot: "qhacks",
    },
    {
        name: "Spotilizer",
        emoji: "&#127925;",
        technologies: "Python, Tkinter, Spotify Web API",
        year: "2019",
        shortDescription: "A customizable, data-centric Spotify music visualizer built in Python",
        longDescription:
        `<ul>
            <li>A visualizer that links to a user's Spotify account and uses hundreds of data points from <a href=\"https://developer.spotify.com/documentation/web-api/\" rel=\"noreferrer\" target=\"_blank\">Spotify's Web API</a> to generate visuals according to rhythm, energy, 'danceability', and many other factors</li>
            <li>Developed by a team of 4 in 10 hours, winning 2nd place at Queen's University during MLH's 2019 Local Hack Day</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/spotilizer",
        screenshot: "spotilizer",
    },
    {
        name: "Glitch",
        emoji: "&#127918;",
        technologies: "Unity Game Engine, C#",
        year: "2018-2019",
        shortDescription: "A unique, monochromatic platformer game for observant minimalists",
        longDescription:
        `<ul>
            <li>A monochromatic platformer game, with a novel mechanic that allows the player to use two different states - glitched and default - at the press of a button to help them win</li>
            <li>Developed by a group of 3 as a final course project for CISC 226 (Game Design) at Queen's University</li>
        </ul>`,
        githubLink: "https://github.com/maxeisen/Glitch",
        projectLink: "https://tamirarnesty.github.io/glitchGame/",
        screenshot: "glitch",
    },
    // {
    //     name: "TicTacToe",
    //     emoji: "&#10060;",
    //     technologies: "Python",
    //     year: "2017",
    //     shortDescription: "A basic, text-based, Pythonic version of tic-tac-toe made in under an hour",
    //     longDescription:
    //     `<ul>
    //         <li>An extremely basic, text-based version of tic-tac-toe</li>
    //         <li>One of my earliest coding projects, developed in about an hour on a flight without access to any online resources</li>
    //         <li>Initially written in Python 2 and ported to Python 3</li>
    //     </ul>`,
    //     githubLink: "https://github.com/maxeisen/TicTacToe",
    //     screenshot: "tictactoe",
    // }
]
