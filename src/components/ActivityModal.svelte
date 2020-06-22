<script>
    export let image;
    export let description;
</script>

<div class="activity-modal">
    <img class="activity-image" src={image} alt="{description}">
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

    .activity-description {
        font-weight: 300;
        margin: 10px auto 10px auto;
        color: black;
        line-height: 1.4;
    }
</style>