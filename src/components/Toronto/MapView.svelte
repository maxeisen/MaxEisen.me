<!--
    MapLibre canvas + pin markers + Strava route overlay.

    Map library is dynamic-imported by the parent so the ~285 KB lib only
    ships on /toronto. Tile styles come from OpenFreeMap (free, no API
    key) and swap reactively when the document `data-theme` flips, so the
    map honours the site's light/dark toggle without a reload.

    Props:
      maplibre      — the MapLibre default export, loaded once by parent
      pins          — visible pin records (after parent's filter)
      routes        — array of { id, name, polyline (Google-encoded) }
                      to overlay as line layer; empty hides the layer
      onselect(pin) — called when a marker is clicked
-->
<script>
    import { onMount, onDestroy } from "svelte";

    let { maplibre, pins = [], routes = [], onselect } = $props();

    let mapEl = $state();
    let map = null;
    const markers = [];
    let themeObserver = null;

    // Limit the map to the GTA + a bit of surrounding area so users can't
    // pan out to Buffalo or zoom out past the city. Coordinates are
    // [lng, lat] (MapLibre convention, opposite of most other APIs).
    const GTA_BOUNDS = [[-79.7, 43.4], [-79.0, 43.95]];
    const MIN_ZOOM = 10;
    const MAX_ZOOM = 17;

    function styleFor(theme) {
        return theme === "dark"
            ? "https://tiles.openfreemap.org/styles/dark"
            : "https://tiles.openfreemap.org/styles/positron";
    }

    function currentTheme() {
        return document.documentElement.getAttribute("data-theme") || "light";
    }

    // Decode a Google-encoded polyline string into [lng, lat] pairs (the
    // order MapLibre wants for GeoJSON). Standard algorithm from Google's
    // public docs — same routine used by the dashboard's Strava widget.
    function decodePolyline(str, precision = 5) {
        if (!str) return [];
        const factor = Math.pow(10, precision);
        let index = 0, lat = 0, lng = 0;
        const points = [];
        while (index < str.length) {
            let b, shift = 0, result = 0;
            do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            points.push([lng / factor, lat / factor]);
        }
        return points;
    }

    function routesToGeoJSON(rs) {
        return {
            type: "FeatureCollection",
            features: (rs || [])
                .map((r) => {
                    const coords = decodePolyline(r.polyline);
                    if (coords.length < 2) return null;
                    return {
                        type: "Feature",
                        properties: { id: r.id, name: r.name },
                        geometry: { type: "LineString", coordinates: coords },
                    };
                })
                .filter(Boolean),
        };
    }

    const ROUTES_SOURCE = "strava-routes";
    const ROUTES_LAYER = "strava-routes-line";

    function addRoutesLayer() {
        if (!map) return;
        if (!map.getSource(ROUTES_SOURCE)) {
            map.addSource(ROUTES_SOURCE, {
                type: "geojson",
                data: routesToGeoJSON(routes),
            });
        }
        if (!map.getLayer(ROUTES_LAYER)) {
            map.addLayer({
                id: ROUTES_LAYER,
                type: "line",
                source: ROUTES_SOURCE,
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": "#fc4c02",   // Strava orange
                    "line-width": 3,
                    "line-opacity": 0.75,
                },
            });
        }
    }

    function placePins() {
        if (!map) return;
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

    onMount(() => {
        if (!maplibre || !mapEl) return;

        map = new maplibre.Map({
            container: mapEl,
            style: styleFor(currentTheme()),
            center: [-79.39, 43.66],
            zoom: 11.5,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            maxBounds: GTA_BOUNDS,
            attributionControl: { compact: true },
        });

        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
            addRoutesLayer();
            placePins();
        });

        // setStyle wipes all custom sources/layers but keeps Markers (those
        // are DOM nodes appended outside the style). Re-add the routes
        // source + layer after every style swap.
        map.on("style.load", () => {
            addRoutesLayer();
        });

        // React to the site's theme toggle. Mutation observer on the html
        // element is cheap (fires only when the attribute actually changes).
        themeObserver = new MutationObserver(() => {
            if (!map) return;
            map.setStyle(styleFor(currentTheme()));
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => {
            themeObserver?.disconnect();
            markers.forEach((m) => m.remove());
            markers.length = 0;
            map?.remove();
            map = null;
        };
    });

    // Re-place pins when the visible set changes (filter chips, etc.).
    $effect(() => {
        pins;
        if (map?.isStyleLoaded()) placePins();
    });

    // Update the routes source when the prop changes (filter chip toggle).
    $effect(() => {
        const data = routesToGeoJSON(routes);
        const source = map?.getSource(ROUTES_SOURCE);
        if (source?.setData) source.setData(data);
    });
</script>

<div class="map-canvas" bind:this={mapEl}></div>

<style>
    .map-canvas {
        position: absolute;
        inset: 0;
    }
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

    :global(.maplibregl-ctrl-attrib) {
        font-size: 10px;
        background: rgba(255, 255, 255, 0.7);
    }
    :global([data-theme="dark"] .maplibregl-ctrl-attrib) {
        background: rgba(0, 0, 0, 0.4);
        color: var(--paragraph-colour);
    }
</style>
