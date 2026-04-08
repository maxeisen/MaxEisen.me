<script>
    import { getContext } from 'svelte';
    import ActivityModal from './modals/ActivityModal.svelte';

    const { open } = getContext('simple-modal');

    const appstorereviewers = {
        video: "https://www.youtube.com/embed/1raFNOEm5rA?start=171&",
        description: "A compilation from my old iOS app reviewing YouTube channel, <a href=\"https://www.youtube.com/user/AppStoreReviewers/videos\" rel=\"noreferrer\" target=\"_blank\">AppStoreReviewers</a> (~79,000 viewers strong)"
    };
    const run = {
        image: "run",
        description: "Me running the 2025 Toronto Waterfront Half Marathon</iframe>"
    };
    const cycle = {
        image: "cycle2",
        description: "Me crossing the finish line of the 122km <a href=\"https://www.rbcgranfondo.com/whistler/\" rel=\"noreferrer\" target=\"_blank\"> 2023 GranFondo Whistler</a> and my latest rides (below)</br></br><iframe height='160' width='85%' frameborder='0' allowtransparency='true' scrolling='no' src='https://www.strava.com/athletes/92118908/activity-summary/dc478a7fc29bd0ba2e32f9cf7fb702d2f7e31df4'></iframe>"
    };
    const drone = {
        video: "https://www.youtube.com/embed/fULlZkgpw50?",
        description: "A promotional spot that I shot and edited of the new GV70 from <a href=\"https://www.genesisyorkdale.ca/\" rel=\"noreferrer\" target=\"_blank\">Genesis Yorkdale</a>"
    };
    const music = {
        image: "guitar",
        description: "Me playing guitar... duh"
        // audio: "./media/audio/helplessly_hoping-max_eisen.mp3",
        // description: "My cover of <a href=\"https://www.youtube.com/watch?v=kyquqw6GeXk\" rel=\"noreferrer\" target=\"_blank\">'Helplessly Hoping' by CSN</a>"
    };
    const skiing = {
        image: "ski",
        description: "Whistler, BC"
    };
    const hiking = {
        image: "hike",
        description: "Lake Country, BC"
    };
    const travelling = {
        image: "travel2",
        description: "St. Barths"
    };
    const tech = {
        image: "frc",
        description: "Captaining my high school robotics team at the 2016 FIRST Robotics Competition",
    };

    const appstorereviewersModal = () => {
        open(ActivityModal, {
            video: appstorereviewers.video, description: appstorereviewers.description
        });
    };
    const runModal = () => {
        open(ActivityModal, {
            image: run.image, description: run.description
        });
    };
    const cycleModal = () => {
        open(ActivityModal, {
            image: cycle.image, description: cycle.description
        });
    };
    const droneModal = () => {
        open(ActivityModal, {
            video: drone.video, description: drone.description
        });
    };
    const musicModal = () => {
        open(ActivityModal, {
            image: music.image, audio: music.audio, description: music.description
        });
    };
    const skiingModal = () => {
        open(ActivityModal, {
            image: skiing.image, description: skiing.description
        });
    };
    const hikingModal = () => {
        open(ActivityModal, {
            image: hiking.image, description: hiking.description
        });
    };
    const travellingModal = () => {
        open(ActivityModal, {
            image: travelling.image, description: travelling.description
        });
    };
    const techModal = () => {
        open(ActivityModal, {
            image: tech.image, description: tech.description
        });
    };    
</script>

<div class="intro-container" id="intro">
    <h1 class="section-title-intro">Who is Max?</h1>
    <div class="intro-paragraph">
        <p class="title-extension">I'm a Software Engineer at <a class="intro-link" href="https://wealthsimple.com" rel="noreferrer" target="_blank">Wealthsimple</a>,
        a Computer Science graduate from <a class="intro-link" href="https://www.queensu.ca/" rel="noreferrer" target="_blank">Queen's University</a>,
        and someone who genuinely loves what he does - building things that work, work well, and work at scale.</p>

        <p>I've spent the last several years shipping ultra-large-scale, production software across fintech, e-commerce, media, and cloud infrastructure. I think in systems, care about craft, and thrive in environments where engineers are expected to own their work end to end.</p>

        <p>Outside of work, you'll find me <activity tabindex="0" on:click={runModal}>running</activity>, <activity tabindex="0" on:click={cycleModal}>cycling</activity>, <activity tabindex="0" on:click={musicModal}>playing guitar</activity>, <activity tabindex="0" on:click={droneModal}>flying drones</activity>,
        <activity tabindex="0" on:click={skiingModal}>skiing</activity>, <activity tabindex="0" on:click={hikingModal}>hiking</activity>, <activity tabindex="0" on:click={travellingModal}>travelling</activity>, or tinkering with <activity tabindex="0" on:click={techModal}>cool technology</activity>.</p>

        <p>Feel free to click around (most things are interactive). <a class="intro-link" href="mailto:intro@maxeisen.me" rel="noreferrer" target="_blank">Email me</a> if you want to connect, or check out my <a class="intro-link" href="/resume.html">resume</a> if you're <span class=static-highlight>recruiting</span>.</p>
    </div>
</div>

<style>
    .section-title-intro {
        margin-top: 10px;
        margin-bottom: 10px;
        text-align: left;
    }

    .title-extension {
        padding-top: 0;
        margin-top: 0;
    }

    .intro-paragraph {
        font-size: 18px;
        margin-bottom: 30px;
        line-height: 1.5;
    }

    .static-highlight {
        font-weight: 400;
        text-shadow: 6px 0px 6px var(--intro-annotation-colour), -6px 0px 6px var(--intro-annotation-colour), 9px 0px 9px var(--intro-annotation-colour), -9px 0px 9px var(--intro-annotation-colour);
    }

    activity {
        color: var(--intro-link-colour);
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
    }

    activity:hover {
        color: var(--main-green);
        cursor: pointer;
    }

    .intro-link {
        font-weight: 400;
        color: var(--intro-link-colour);
    }

    .intro-link:hover {
        color: var(--link-hover-colour);
    }

    @media only screen and (max-width: 460px) {
        .section-title-intro {
            font-size: 36px;
        }

        .intro-paragraph {
            font-size: 16px;
        }
    }
</style>
