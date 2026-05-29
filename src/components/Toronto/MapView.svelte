<!--
    MapLibre canvas + custom pin markers. Map library is dynamic-imported
    by the parent so the ~200 KB lib only ships on /toronto.

    Emits `onselect(pin)` when a marker is clicked.
-->
<script>
    import { onMount, onDestroy } from "svelte";

    let { maplibre, pins = [], onselect } = $props();

    let mapEl = $state();
    let map = null;
    const markers = [];

    // OpenFreeMap public CDN — free, no API key required. "positron" is a
    // muted light style; "dark_matter" is the dark equivalent. Picked here
    // from the document's current theme; theme switching mid-session would
    // need a setStyle call (defer for now).
    function styleFor(theme) {
        return theme === "dark"
            ? "https://tiles.openfreemap.org/styles/dark"
            : "https://tiles.openfreemap.org/styles/positron";
    }

    onMount(() => {
        if (!maplibre || !mapEl) return;

        const theme = document.documentElement.getAttribute("data-theme") || "light";
        map = new maplibre.Map({
            container: mapEl,
            style: styleFor(theme),
            center: [-79.39, 43.66],     // downtown TO
            zoom: 11.5,
            attributionControl: { compact: true },
        });

        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => placePins());

        return () => {
            markers.forEach((m) => m.remove());
            markers.length = 0;
            map?.remove();
            map = null;
        };
    });

    function placePins() {
        if (!map) return;
        // Clear any existing markers (e.g., if pins prop changes after load).
        markers.forEach((m) => m.remove());
        markers.length = 0;

        for (const pin of pins) {
            const el = document.createElement("button");
            el.className = "map-pin";
            el.type = "button";
            el.title = pin.name;
            el.setAttribute("aria-label", pin.name);
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                onselect?.(pin);
                map.flyTo({ center: [pin.lng, pin.lat], zoom: 14, duration: 600 });
            });

            const marker = new maplibre.Marker({ element: el, anchor: "bottom" })
                .setLngLat([pin.lng, pin.lat])
                .addTo(map);
            markers.push(marker);
        }
    }

    // If pins prop changes after first paint (e.g. hot reload, async fetch),
    // re-place. The map itself is created once.
    $effect(() => {
        pins;
        if (map?.isStyleLoaded()) placePins();
    });
</script>

<div class="map-canvas" bind:this={mapEl}></div>

<style>
    .map-canvas {
        position: absolute;
        inset: 0;
    }
    /* Map markers — pin-shaped, accent green, scale on hover. The marker
       element is created in JS (so we can pass it to maplibre.Marker), but
       its styling lives here. :global() because the element is appended
       outside this component's scoped CSS. */
    :global(.map-pin) {
        width: 22px;
        height: 30px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        position: relative;
        transition: transform 0.15s ease;
    }
    :global(.map-pin::before) {
        content: "";
        position: absolute;
        inset: 0;
        background: var(--main-green);
        border: 2px solid #fff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
        transform-origin: center;
    }
    :global(.map-pin::after) {
        content: "";
        position: absolute;
        top: 7px;
        left: 50%;
        margin-left: -3px;
        width: 6px;
        height: 6px;
        background: #fff;
        border-radius: 50%;
    }
    :global(.map-pin:hover) { transform: translateY(-2px) scale(1.08); }
    :global(.map-pin:active) { transform: translateY(0) scale(0.96); }

    /* MapLibre default UI tweaks: nudge attribution + nav control to fit
       the site's aesthetic without fully restyling them. */
    :global(.maplibregl-ctrl-attrib) {
        font-size: 10px;
        background: rgba(255, 255, 255, 0.7);
    }
    :global([data-theme="dark"] .maplibregl-ctrl-attrib) {
        background: rgba(0, 0, 0, 0.4);
        color: var(--paragraph-colour);
    }
</style>
