<script>
    export let school;
    export let location;
    export let degree;
    export let major;
    export let years;
    export let courses;
    export let committees;
</script>

<div class="education-modal">
    <h1 class="modal-title">{school}</h1>
    <h2 class="modal-subtitle">{@html degree}</h2>
    <h3 class="modal-major">{@html major}</h3>
    <h3 class="modal-meta">{years} in {location}</h3>
    <p class="education-line"><b>Relevant Courses:</b> {courses}</p>
    <p class="education-line"><b>Committees:</b> {committees}</p>
    <p class="ta-note">*Teaching Assistant or Executive position</p>
</div>

<style>
    /* :global() so styles apply when modal is rendered via dynamic component */
    :global(.education-modal) {
        color: black;
    }

    /* Degree-major sub-subtitle — smaller than .modal-subtitle, only used here */
    :global(.education-modal .modal-major) {
        font-size: 20px;
        margin: 0 auto;
        text-align: center;
        color: var(--modal-title-colour);
        line-height: 1.4;
    }

    :global(.education-modal .education-line) {
        font-size: 15px;
        text-align: center;
        margin: 14px auto;
        color: var(--modal-text-colour);
        line-height: 1.7;
    }

    :global(.education-modal .ta-note) {
        margin-top: 20px;
        font-size: 11px;
    }
</style>
