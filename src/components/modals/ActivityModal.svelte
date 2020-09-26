<script>
    export let image;
    export let audio;
    export let video;
    export let description;
</script>

<div class="activity-modal">
    {#if image}
        <img class="activity-image" src={image} alt="{description}">
    {/if}
    {#if audio}
        <audio class="activity-audio" controls>
            <source src={audio} type="audio/mpeg">
            <track kind="captions">
            Your browser does not support the audio element.
        </audio>
    {/if}
    {#if video}
        <video class="activity-video" controls>
            <source src="{video}.webm" type="video/webm">
            <source src="{video}.mp4" type="video/mp4">
            <track kind="captions">
            Your browser does not support the video element.
        </video>
    {/if}
        <h3 class="activity-description" style="text-align: center">{@html description}</h3>
</div>

<style>
    .activity-modal {
        color: black;
        text-align: center;
    }

    .activity-image {
        width: 80%;
        height: auto;
        border-radius: 5px;
        box-shadow: 0px 0px 10px #0000009a;
        margin: 20px auto 0 auto;
    }

    .activity-audio, .activity-video {
        margin: 20px auto 0 auto;
    }

    .activity-video {
        width: 85%;
    }

    .activity-description {
        font-weight: 300;
        margin: 10px auto 10px auto;
        padding-left: 20px;
        padding-right: 20px;
        color: black;
        line-height: 1.4;
    }
</style>