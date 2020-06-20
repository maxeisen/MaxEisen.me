<script>
    import Annotation from 'svelte-rough-notation';
    import { annotationGroup } from 'rough-notation';
    import { onMount } from 'svelte';

    let introDescriptors = [];
    onMount(() => {
        let ids = annotationGroup(introDescriptors);
        setTimeout(() => {
            ids.show();
        }, 4000);
    });
</script>

<h1 class="section-title-intro">My Name is Max Eisen...</h1>
<div class="intro-paragraph">
    <p class="title-extension">and I am a <Annotation bind:this={introDescriptors[0]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8"><descriptor>Computer Science</descriptor></Annotation>
    student at <a class="intro-link" href="https://www.queensu.ca/" target="_blank">Queen's University</a> with a fascination for technology.</p>

    <p>I am also a <descriptor><Annotation bind:this={introDescriptors[1]} type="box" padding={2} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">computational thinker</Annotation></descriptor>
    who enjoys programming, software and web development, leading teams, beta testing, automation, and UI/UX design.
    In my free time, you can find me skiing, hiking, travelling, playing guitar, and trying new tech.</p>

    <p>I spend a fair amount of time in front of a computer, but I am a <descriptor><Annotation bind:this={introDescriptors[2]} type="circle" padding={5} color="rgba(0, 187, 162, 0.5)" strokeWidth="0.8">sociable person</Annotation></descriptor>
    who prefers to work with, and be around others. Whether with a project team, a customer, a supervisor, or friends, I strive to communicate
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

    .intro-link {
        font-weight: 400;
        color: rgb(173, 222, 255);
    }

    .intro-link:hover {
        color: #00bba2;
    }
</style>