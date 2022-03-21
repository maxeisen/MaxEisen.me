<script>
    export let image;
    export let audio;
    export let video;
    export let description;
</script>

<div class="activity-modal">
    {#if image}
        <picture>
            <source srcset={`./img/activities/${image}.webp`} type="image/webp">
            <source srcset={`./img/activities/${image}.jpg`} type="image/jpeg"> 
            <img class="activity-image" src={`./img/activities/${image}.jpg`} alt={description}>
        </picture>
    {/if}
    {#if audio}
        <audio class="activity-audio" controls>
            <source src={audio} type="audio/mpeg">
            <track kind="captions">
            Your browser does not support the audio element.
        </audio>
    {/if}
    {#if video}
        <iframe width="560" height="315" src="{video}hd=1&autoplay=0&modestbranding=1&showinfo=0&rel=0" title="{description}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
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

    .activity-audio {
        margin: 20px auto 0 auto;
    }

    .activity-description {
        font-weight: 300;
        margin: 10px auto 10px auto;
        padding-left: 20px;
        padding-right: 20px;
        color: var(--modal-title-colour);
        line-height: 1.4;
    }
</style>