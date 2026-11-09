<script>
    import Section from '../../../lib/ui/Section.svelte';
    import skills from '@content/skills.json';
</script>

<Section title="Tools I use" id="skills">
    <ul>
        {#each skills as skill}
            <li>{skill}</li>
        {/each}
    </ul>
</Section>

<style>
    ul {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li {
        padding: 4px 10px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: var(--font-sm);
        color: var(--text);
    }
</style>
