<!--
    A hobby, opened from the intro's "Outside of work…" sentence: a photo,
    its caption, and optionally a link onward. For running and cycling it
    also shows the year so far and recent activities from Strava.

    Props
      image    file stem under /img/activities (webp + jpg)
      audio / video   optional media instead of / beside the photo
      caption  what the photo is. May hold inline links to other sites;
               those are marked ↗ so they read as leaving.
      link     { href, label } — the next step, its own row under the
               caption: → for a page on this site, ↗ for anywhere else.
      strava   "run" | "ride" — adds the Strava summary
-->
<script>
    import { onMount } from 'svelte';
    import { externalizeLinks } from '../../../lib/ui/externalLinks.js';
    import { fetchJsonSwr } from '../../../lib/data/swrCache.js';
    import { STRAVA_FEED_URL } from '../../../lib/strava.js';
    import StravaActivityList from '../widgets/StravaActivityList.svelte';
    import Stat from '../../../lib/ui/Stat.svelte';
    import StatGrid from '../../../lib/ui/StatGrid.svelte';

    let { image = null, audio = null, video = null, caption = '', link = null, strava = null } = $props();

    let profile = $state(null);

    onMount(async () => {
        if (!strava) return;
        try {
            const data = await fetchJsonSwr(STRAVA_FEED_URL);
            profile = { bike: data?.bike ?? null, shoes: data?.shoes ?? null, ytd: data?.ytd ?? null };
        } catch {
            // No profile: the Strava section just doesn't render.
        }
    });

    const formatKm = (m) => {
        if (m == null) return '—';
        const km = m / 1000;
        return km >= 100 ? `${Math.round(km).toLocaleString()} km` : `${km.toFixed(1)} km`;
    };
    const formatMeters = (m) => (m == null ? '—' : `${Math.round(m).toLocaleString()} m`);
    const currentYear = new Date().getFullYear();

    const ytd = $derived(profile && strava ? profile.ytd?.[strava] : null);
    const gear = $derived(profile ? (strava === 'ride' ? profile.bike : strava === 'run' ? profile.shoes : null) : null);
    const gearLabel = $derived(strava === 'ride' ? 'Recently rode' : 'Recently ran in');

    const isInternal = $derived(link?.href?.startsWith('/') ?? false);
    const alt = $derived(caption.replace(/<[^>]+>/g, ''));
</script>

<figure class="activity-modal">
    {#if image}
        <picture>
            <source srcset={`./img/activities/${image}.webp`} type="image/webp">
            <img class="photo" src={`./img/activities/${image}.jpg`} {alt}>
        </picture>
    {/if}
    {#if audio}
        <audio class="audio" controls>
            <source src={audio} type="audio/mpeg">
            <track kind="captions">
        </audio>
    {/if}
    {#if video}
        <iframe class="video" src="{video}hd=1&autoplay=0&modestbranding=1&showinfo=0&rel=0" title={alt} frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    {/if}

    <figcaption class="caption">{@html externalizeLinks(caption)}</figcaption>

    {#if link}
        <a
            class="next no-ext-arrow"
            href={link.href}
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noreferrer'}
        >
            <span>{link.label}</span>
            <span class="arrow" aria-hidden="true">{isInternal ? '→' : '↗'}</span>
        </a>
    {/if}

    {#if strava && (ytd || gear?.name)}
        <section class="strava">
            {#if ytd}
                <StatGrid columns={3} rule="top" gap={3}>
                    <Stat label="{currentYear} distance" value={formatKm(ytd.distance)} />
                    <Stat label={strava === 'ride' ? 'Rides' : 'Runs'} value={ytd.count} />
                    <Stat label="Climbed" value={formatMeters(ytd.elevationGain)} />
                </StatGrid>
            {/if}
            {#if gear?.name}
                <p class="gear">{gearLabel} <strong>{gear.name}</strong></p>
            {/if}
        </section>
    {/if}

    {#if strava}
        <StravaActivityList type={strava} />
    {/if}

</figure>

<style>
    .activity-modal { margin: 0; text-align: left; }
    .photo { display: block; width: 100%; height: auto; border-radius: var(--radius); }
    .audio { width: 100%; margin-top: var(--space-4); }
    .video { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: var(--radius); }

    /* The caption reads as a caption: the photo's subject in strong ink.
       Off-site links in it get the global ↗ (global.css). */
    .caption {
        margin: var(--space-4) 0 0;
        padding-right: var(--space-5);
        font-size: var(--font-lg);
        font-weight: var(--weight-medium);
        line-height: 1.45;
        letter-spacing: -0.01em;
        color: var(--text-strong);
    }
    .caption :global(a) {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: var(--border-strong);
        text-underline-offset: 0.2em;
        transition: text-decoration-color var(--dur-fast) var(--ease);
    }
    .caption :global(a:hover) { text-decoration-color: currentColor; }

    .strava { margin-top: var(--space-4); }
    .gear { margin: var(--space-3) 0 0; font-size: var(--font-sm); color: var(--text-2); }
    .gear strong { font-weight: var(--weight-medium); color: var(--text-strong); }

    /* The next step: its own row right under the caption, styled as a
       destination rather than as more of the sentence. */
    .next {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-top: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font-size: var(--font-sm);
        font-weight: var(--weight-medium);
        color: var(--text-strong);
        transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
    }
    .next:hover { background: var(--surface-2); border-color: var(--border-strong); color: var(--text-strong); }
    .arrow { color: var(--text-3); transition: transform var(--dur-fast) var(--ease); }
    .next:hover .arrow { transform: translateX(2px); }
</style>
