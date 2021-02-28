<script>
    import Annotation from 'svelte-rough-notation';
    import { annotationGroup } from 'rough-notation';
    import { onMount, getContext } from 'svelte';
    import ActivityModal from './modals/ActivityModal.svelte';

    let visible = false;
    onMount(() => {
        setTimeout(() => {
            visible = true;
        }, 1000);
    });

    let introDescriptors = [];
    onMount(() => {
        let ids = annotationGroup(introDescriptors);
        setTimeout(() => {
            ids.show();
        }, 1500);
    });

    const { open } = getContext('simple-modal');

    const appstorereviewers = {
        video: "./media/video/appstorereviewers_compilation",
        description: "My old YouTube channel, <a href=\"https://www.youtube.com/user/AppStoreReviewers/videos\" rel=\"noreferrer\" target=\"_blank\">AppStoreReviewers</a> - reviewing iOS apps before iOS was called iOS (78,000 viewers strong)"
    };
    const skiing = {
        image: "./img/activities/skiing.webp",
        description: "Skiing in Whistler, BC"
    };
    const hiking = {
        image: "./img/activities/hiking.webp",
        description: "Hiking in Lake Country, BC"
    };
    const travelling = {
        image: "./img/activities/travelling.webp",
        description: "Travelling in Cartagena, Colombia"
    };
    const music = {
        image: "./img/activities/guitar.webp",
        audio: "./media/audio/helplessly_hoping-max_eisen.mp3",
        description: "Recording a cover of <a href=\"https://www.youtube.com/watch?v=kyquqw6GeXk\" rel=\"noreferrer\" target=\"_blank\">'Helplessly Hoping' by CSN</a>"
    };
    const tech = {
        image: "./img/activities/frc.webp",
        description: "Leading my high school robotics team at the 2016 FIRST Robotics Competition",
    };

    const appstorereviewersModal = () => {
        open(ActivityModal, {
            video: appstorereviewers.video, description: appstorereviewers.description
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
    const musicModal = () => {
        open(ActivityModal, {
            image: music.image, audio: music.audio, description: music.description
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
        <p class="title-extension">I am a Computer Science student at <a class="intro-link" href="https://www.queensu.ca/" rel="noreferrer" target="_blank">Queen's University</a>
        with a <Annotation bind:this={introDescriptors[0]} type="underline" padding={2} color="var(--intro-annotation-colour)" strokeWidth="1">creative</Annotation> and
        <Annotation bind:this={introDescriptors[1]} type="underline" padding={2} color="var(--intro-annotation-colour)" strokeWidth="1">curious</Annotation> mind,
        and a fascination for all technology.</p>

        <p>Also a <descriptor><Annotation bind:this={introDescriptors[2]} type="box" padding={2} color="var(--intro-annotation-colour)" strokeWidth="0.8">computational thinker</Annotation></descriptor>,
        I am experienced in software and web development, hardware repair, agile methodologies, UI/UX design, and <activity tabindex="0" on:click={appstorereviewersModal}>iOS app reviewing</activity>.
        As a <descriptor><Annotation bind:this={introDescriptors[3]} type="underline" padding={2} color="var(--intro-annotation-colour)" strokeWidth="0.8">sociable professional</Annotation></descriptor>,
        I enjoy working with teams and being around like-minded people. No matter the role, I strive to communicate effectively and confidently.</p>
        
        <p>In my free time, I love to listen to and <activity tabindex="0" on:click={musicModal}>record music</activity>, <activity tabindex="0" on:click={skiingModal}>ski</activity>,
        <activity tabindex="0" on:click={hikingModal}>hike</activity>, <activity tabindex="0" on:click={travellingModal}>travel</activity>, and <activity tabindex="0" on:click={techModal}>work with cool technology</activity>.</p>
        
        <p>Please explore and enjoy my portfolio website, click on things for more information, and <a class="intro-link" href="mailto:max.eisen@queensu.ca" rel="noreferrer" target="_blank">email me</a> if you have any questions or comments.</p>
        
        <p>If you are <Annotation bind:this={introDescriptors[4]} type="highlight" color="var(--intro-highlight-colour)">recruiting</Annotation>, please view and download (print to PDF) my <a class="intro-link" href="/resume">resume</a>.</p>
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

    descriptor {
        white-space: nowrap;
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
