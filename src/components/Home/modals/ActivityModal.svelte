<script>
    import { onMount } from 'svelte';
    import StravaActivityList from '../widgets/StravaActivityList.svelte';

    export let image;
    export let audio;
    export let video;
    export let description;
    export let strava = null; // 'run' | 'ride' — when set, renders YTD + gear + recent activities

    let profile = null; // null = loading, {} = loaded
    let profileError = false;

    onMount(async () => {
        if (!strava) return;
        try {
            const res = await fetch('/.netlify/functions/stravaProfile');
            if (!res.ok) throw new Error(`status ${res.status}`);
            profile = await res.json();
        } catch {
            profileError = true;
        }
    });

    const formatKm = (m) => {
        if (m == null) return '—';
        const km = m / 1000;
        return km >= 1000
            ? `${Math.round(km).toLocaleString()} km`
            : km >= 100 ? `${Math.round(km).toLocaleString()} km`
            : `${km.toFixed(1)} km`;
    };
    const formatMeters = (m) => (m == null ? '—' : `${Math.round(m).toLocaleString()} m`);
    const currentYear = new Date().getFullYear();

    $: ytdTotals = profile && strava ? profile.ytd?.[strava] : null;
    $: gear = profile && strava === 'ride' ? profile.bike : profile && strava === 'run' ? profile.shoes : null;
    $: gearLabel = strava === 'ride' ? 'Currently riding' : strava === 'run' ? 'Currently running in' : '';
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
        <iframe width="100%" height="315" src="{video}hd=1&autoplay=0&modestbranding=1&showinfo=0&rel=0" title="{description}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    {/if}
    <h3 class="activity-description">{@html description}</h3>

    {#if strava && (ytdTotals || gear)}
        <div class="strava-profile">
            {#if ytdTotals}
                <div class="strava-profile-ytd">
                    <div class="strava-profile-ytd-label">{currentYear} to date</div>
                    <div class="strava-profile-ytd-stats">
                        <span><strong>{formatKm(ytdTotals.distance)}</strong></span>
                        <span><strong>{ytdTotals.count}</strong> {strava === 'ride' ? 'rides' : 'runs'}</span>
                        <span><strong>{formatMeters(ytdTotals.elevationGain)}</strong> climbed</span>
                    </div>
                </div>
            {/if}
            {#if gear?.name}
                <div class="strava-profile-gear">
                    {gearLabel} <strong>{gear.name}</strong>
                </div>
            {/if}
        </div>
    {/if}

    {#if strava}
        <StravaActivityList type={strava} />
    {/if}
</div>

<style>
    :global(.activity-modal) {
        color: black;
        text-align: center;
    }

    :global(.activity-modal .activity-image) {
        width: 90%;
        height: auto;
        border-radius: 5px;
        box-shadow: 0px 0px 10px #0000009a;
        margin: 20px auto 0 auto;
    }

    :global(.activity-modal .activity-audio) {
        margin: 20px auto 0 auto;
    }

    :global(.activity-modal .activity-description) {
        font-weight: 300;
        margin: 10px auto 10px auto;
        padding-left: 20px;
        padding-right: 20px;
        color: var(--modal-title-colour);
        line-height: 1.4;
    }

    :global(.activity-modal .strava-profile) {
        max-width: 100%;
        margin: 1rem auto 0.25rem auto;
        padding: 0 20px;
        text-align: left;
        color: var(--modal-title-colour, #333);
    }

    :global(.activity-modal .strava-profile-ytd) {
        padding: 0.65rem 0.85rem;
        border-radius: 10px;
        background: var(--main-green-translucent, rgba(0, 128, 111, 0.12));
        border: 1px solid var(--main-green-translucent, rgba(0, 128, 111, 0.18));
    }

    :global(.activity-modal .strava-profile-ytd-label) {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green, #00806f);
        margin-bottom: 0.3rem;
    }

    :global(.activity-modal .strava-profile-ytd-stats) {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1rem;
        font-size: 0.85rem;
        color: var(--modal-title-colour, #333);
    }

    :global(.activity-modal .strava-profile-ytd-stats strong) {
        font-family: 'Fraunces', 'Iowan Old Style', 'Times New Roman', serif;
        font-weight: 600;
        font-size: 1rem;
        letter-spacing: -0.01em;
    }

    :global(.activity-modal .strava-profile-gear) {
        margin-top: 0.55rem;
        font-size: 0.85rem;
        color: var(--modal-title-colour, #555);
        opacity: 0.85;
    }
</style>
