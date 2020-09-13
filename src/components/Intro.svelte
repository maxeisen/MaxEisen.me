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
        }, 2000);
    });

    const { open } = getContext('simple-modal');

    const skiing = {
        image: "./img/activities/skiing.webp",
        description: "Whistler, BC"
    };
    const hiking = {
        image: "./img/activities/hiking.webp",
        description: "Lake Country, BC"
    };
    const travelling = {
        image: "./img/activities/travelling.webp",
        description: "Cartagena, Colombia"
    };
    const guitar = {
        image: "./img/activities/guitar.webp",
        audio: "./audio/helplessly_hoping-max_eisen.mp3",
        description: "Covering <a href=\"https://www.youtube.com/watch?v=kyquqw6GeXk\" rel=\"noreferrer\" target=\"_blank\">'Helplessly Hoping' by CSN</a> - listen above!"
    };
    const tech = {
        image: "./img/activities/tech.webp",
        description: "My first computer repair - replacing a busted HDD",
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
    const guitarModal = () => {
        open(ActivityModal, {
            image: guitar.image, audio: guitar.audio, description: guitar.description
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
        <p class="title-extension">I am a <Annotation bind:this={introDescriptors[0]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8"><descriptor>Computer Science</descriptor></Annotation>
        student at <a class="intro-link" href="https://www.queensu.ca/" rel="noreferrer" target="_blank">Queen's University</a> with a fascination for all technology.</p>

        <p>Also a <descriptor><Annotation bind:this={introDescriptors[1]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">computational thinker</Annotation></descriptor>,
        I am experienced in software and web development, hardware repair, agile methodologies, UI/UX design, and <a class="intro-link" href="https://www.youtube.com/user/AppStoreReviewers/videos" rel="noreferrer" target="_blank">iOS app reviewing</a>.
        In my free time, I am usually <activity tabindex="0" on:click={guitarModal}>playing guitar</activity>, <activity tabindex="0" on:click={skiingModal}>skiing</activity>, <activity tabindex="0" on:click={hikingModal}>hiking</activity>, <activity tabindex="0" on:click={travellingModal}>travelling</activity>, or <activity tabindex="0" on:click={techModal}>messing around with technology</activity>.</p>

        <p>I am a <descriptor><Annotation bind:this={introDescriptors[2]} type="circle" padding={5} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">sociable person</Annotation></descriptor>
        who loves to work with, and be around others. Whether with a project team, a customer, a supervisor, or friends, I strive to communicate
        <Annotation bind:this={introDescriptors[3]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">effectively</Annotation> and
        <Annotation bind:this={introDescriptors[4]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">confidently</Annotation>.</p>
        
        <p>Please explore and enjoy my portfolio website, click on things for more information, and <a class="intro-link" href="mailto:max.eisen@queensu.ca" rel="noreferrer" target="_blank">email me</a> if you have any questions or comments.
        If you are recruiting, check out and download (print to PDF) my <a class="intro-link" href="/resume">resume</a>.</p>
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
        color: rgb(173, 222, 255);
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
    }

    activity:hover {
        color: #00bba2;
        cursor: pointer;
    }

    .intro-link {
        font-weight: 400;
        color: rgb(173, 222, 255);
    }

    .intro-link:hover {
        color: #00bba2;
    }

    @media only screen and (max-width: 460px) {
        .intro-container {
            padding: 20px;
            border-radius: 10px;
            background: rgba(114, 114, 114, 0.35);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .section-title-intro {
            font-size: 36px;
        }

        .intro-paragraph {
            font-size: 16px;
        }
    }
</style>
