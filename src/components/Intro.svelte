<script>
    import { getContext } from 'svelte';
    import ActivityModal from './modals/ActivityModal.svelte';

    const { open } = getContext('simple-modal');

    const appstorereviewers = {
        video: "https://www.youtube.com/embed/1raFNOEm5rA?start=171&",
        description: "A compilation from my old iOS app reviewing YouTube channel, <a href=\"https://www.youtube.com/user/AppStoreReviewers/videos\" rel=\"noreferrer\" target=\"_blank\">AppStoreReviewers</a> (~79,000 viewers strong)"
    };
    const cycle = {
        image: "cycle",
        description: "Me crossing the finish line of the 122km <a href=\"https://www.rbcgranfondo.com/whistler/\" rel=\"noreferrer\" target=\"_blank\"> 2022 GranFondo Whistler</a>"
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

<div class="intro-container">
    <h1 class="section-title-intro">Who is Max?</h1>
    <div class="intro-paragraph">
        <p class="title-extension">I am a Software Development Engineer at <a class="intro-link" href="https://aws.amazon.com/" rel="noreferrer" target="_blank">Amazon</a>
        and a Computer Science graduate from <a class="intro-link" href="https://www.queensu.ca/" rel="noreferrer" target="_blank">Queen's University</a>,
        with a creative and curious mind, a passion for adventure, and a fascination for all technology.</p>

        <p>Also a computational thinker, I am experienced in software and web development, hardware repair, agile methodologies, UI/UX design, and <activity tabindex="0" on:click={appstorereviewersModal}>iOS app reviewing</activity>.
        As a software engineer by day, I enjoy working with teams and being around like-minded people. With every new role I take on, I strive to communicate effectively and confidently, and lead the team as a creative problem solver.</p>
        
        <p>In my free time, I love to <activity tabindex="0" on:click={cycleModal}>cycle</activity>, <activity tabindex="0" on:click={droneModal}>drone</activity>, <activity tabindex="0" on:click={musicModal}>play guitar</activity>,
        <activity tabindex="0" on:click={skiingModal}>ski</activity>, <activity tabindex="0" on:click={hikingModal}>hike</activity>, <activity tabindex="0" on:click={travellingModal}>travel</activity>, and <activity tabindex="0" on:click={techModal}>work with cool technology</activity>.</p>
        
        <p>Please explore and enjoy my portfolio website, click on things for more information, and <a class="intro-link" href="mailto:intro@maxeisen.me" rel="noreferrer" target="_blank">email me</a> if you have any questions or comments.</p>
        
        <p>If you are <span class=static-highlight>recruiting</span>, please view and download (print to PDF) my <a class="intro-link" href="/resume">resume</a>.</p>
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
