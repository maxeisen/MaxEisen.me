<script>
    import Annotation from 'svelte-rough-notation';
    import { annotationGroup } from 'rough-notation';
    import { onMount, getContext } from 'svelte';
    import ActivityModal from './ActivityModal.svelte';

    let introDescriptors = [];
    onMount(() => {
        let ids = annotationGroup(introDescriptors);
        setTimeout(() => {
            ids.show();
        }, 4000);
    });

    const { open } = getContext('simple-modal');

    const skiing = {
        image: "./img/activities/skiing.jpg",
        description: "Whistler, BC (2018)"
    };
    const hiking = {
        image: "./img/activities/hiking.jpg",
        description: "Lake Country, BC (2016)"
    };
    const travelling = {
        image: "./img/activities/travelling.jpg",
        description: "Cartagena, Colombia (2019)"
    };
    const guitar = {
        image: "./img/activities/guitar.jpg",
        description: "Playing <a href=\"https://www.youtube.com/watch?v=kyquqw6GeXk\" target=\"_blank\">'Helplessly Hoping' by CSN</a> (2020)"
    };
    const tech = {
        image: "./img/activities/tech.jpg",
        description: "My first computer repair - replacing a busted HDD (2010)",
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
            image: guitar.image, description: guitar.description
        });
    };
    const techModal = () => {
        open(ActivityModal, {
            image: tech.image, description: tech.description
        });
    };    
</script>

<h1 class="section-title-intro">My Name is Max Eisen...</h1>
<div class="intro-paragraph">
    <p class="title-extension">and I am a <Annotation bind:this={introDescriptors[0]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8"><descriptor>Computer Science</descriptor></Annotation>
    student at <a class="intro-link" href="https://www.queensu.ca/" target="_blank">Queen's University</a> with a fascination for technology.</p>

    <p>I am also a <descriptor><Annotation bind:this={introDescriptors[1]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">computational thinker</Annotation></descriptor>
    who enjoys programming, software and web development, leading teams, beta testing, automation, UI/UX design, and <a class="intro-link" href="https://www.youtube.com/user/AppStoreReviewers/videos" target="_blank">iOS app reviewing</a>.
    In my free time, I am usually <activity on:click={skiingModal}>skiing</activity>, <activity on:click={hikingModal}>hiking</activity>, <activity on:click={travellingModal}>travelling</activity>, <activity on:click={guitarModal}>playing guitar</activity>, or <activity on:click={techModal}>messing around with technology</activity>.</p>

    <p>When I'm away from my computer, I am a
    <descriptor><Annotation bind:this={introDescriptors[2]} type="circle" padding={5} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">sociable person</Annotation></descriptor>
    who loves to work with, and be around others. Whether with a project team, a customer, a supervisor, or friends, I strive to communicate
    <Annotation bind:this={introDescriptors[3]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">effectively</Annotation> and
    <Annotation bind:this={introDescriptors[4]} type="underline" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="1">confidently</Annotation>.</p>
    
    <p>Feel free to explore my website, click on things for more information, and <a class="intro-link" href="mailto:max.eisen@queensu.ca" target="_blank">email me</a> if you have any questions or comments.</p>
</div>

<style>
    .section-title-intro {
        margin-top: 20px;
        padding-bottom: 0;
        margin-bottom: 0;
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
</style>