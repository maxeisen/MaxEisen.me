<!--
    Slide-in detail panel for the currently selected pin. Right-side
    drawer on desktop, bottom sheet on mobile. Empty when `pin` is null.
-->
<script>
    let { pin = null, onclose } = $props();
</script>

{#if pin}
    <aside class="pin-panel" role="dialog" aria-label={pin.name}>
        <button class="pin-panel-close" type="button" onclick={onclose} aria-label="Close">×</button>

        <div class="pin-panel-body">
            <h2 class="pin-panel-name">{pin.name}</h2>
            {#if pin.category}
                <div class="pin-panel-category">{pin.category}</div>
            {/if}
            {#if pin.notes}
                <p class="pin-panel-notes">{pin.notes}</p>
            {:else if pin._review}
                <p class="pin-panel-notes pin-panel-notes--draft">{pin._review}</p>
                <p class="pin-panel-draft-tag">— original Google review (not yet rewritten)</p>
            {/if}
            {#if pin.address}
                <p class="pin-panel-address">{pin.address}</p>
            {/if}
            {#if pin.googleMapsUrl}
                <a class="pin-panel-link" href={pin.googleMapsUrl} target="_blank" rel="noreferrer">
                    Open in Google Maps ↗
                </a>
            {/if}
        </div>
    </aside>
{/if}

<style>
    .pin-panel {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(380px, 92vw);
        background: var(--inner-background, rgba(20, 20, 20, 0.92));
        border-left: 1px solid var(--main-green-translucent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 5;
        overflow-y: auto;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
        animation: slide-in 0.2s ease-out;
    }
    @keyframes slide-in {
        from { transform: translateX(100%); }
        to   { transform: translateX(0); }
    }
    .pin-panel-close {
        position: absolute;
        top: 0.6rem;
        right: 0.85rem;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        background: rgba(80, 80, 80, 0.6);
        color: #fff;
        border: none;
        font-size: 1.25rem;
        line-height: 1;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
    }
    .pin-panel-close:hover { background: rgba(110, 110, 110, 0.7); }

    .pin-panel-body {
        padding: 1.75rem 1.5rem 2rem 1.5rem;
    }

    .pin-panel-name {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1.55rem;
        line-height: 1.2;
        letter-spacing: -0.02em;
        color: var(--header-colour);
        margin: 0 0 0.5rem 0;
    }
    .pin-panel-category {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--main-green);
        margin-bottom: 1rem;
    }
    .pin-panel-notes {
        font-size: 0.95rem;
        line-height: 1.55;
        color: var(--paragraph-colour);
        margin: 0 0 1rem 0;
    }
    .pin-panel-notes--draft {
        opacity: 0.7;
        font-style: italic;
    }
    .pin-panel-draft-tag {
        font-size: 0.72rem;
        opacity: 0.5;
        margin: -0.6rem 0 1rem 0;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .pin-panel-address {
        font-size: 0.82rem;
        color: var(--paragraph-colour);
        opacity: 0.65;
        margin: 0 0 1rem 0;
    }
    .pin-panel-link {
        display: inline-block;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--main-green);
        text-decoration: none;
        border-bottom: 1px dotted var(--main-green-translucent);
        padding-bottom: 1px;
        transition: border-color 0.2s ease;
    }
    .pin-panel-link:hover { border-bottom-color: var(--main-green); }

    @media (max-width: 600px) {
        .pin-panel {
            top: auto;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            max-height: 60vh;
            border-left: none;
            border-top: 1px solid var(--main-green-translucent);
            border-radius: 16px 16px 0 0;
            animation: slide-up 0.2s ease-out;
            box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.35);
        }
        @keyframes slide-up {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
        }
    }
</style>
