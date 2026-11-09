<!--
    An activity's name (linking out to Strava) with its tags underneath.
    Shared by the run and ride details.

    Props
      id     Strava activity id
      name   activity name
      tags   snippet — Tag components and any short note beside them
-->
<script>
    let { id, name, tags = null } = $props();
</script>

<a class="title" href="https://www.strava.com/activities/{id}" target="_blank" rel="noreferrer">{name}</a>
{#if tags}
    <p class="tags">{@render tags()}</p>
{/if}

<style>
    .title {
        display: block;
        font-size: var(--font-lg);
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        line-height: 1.25;
        color: var(--text-strong);
    }
    .title:hover { color: var(--accent); }
    .tags {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: var(--space-2) 0 0;
        font-size: var(--font-2xs);
        color: var(--text-3);
    }
    .tags:empty { display: none; }
</style>
