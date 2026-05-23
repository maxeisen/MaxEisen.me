// Cross-widget shared state. Weather computes daylight delta from sunrise/sunset
// (which it owns) and the Clock widget displays it; Spotify state is shared
// between the inline widget and the fullscreen overlay.
//
// $state objects exported from a .svelte.js module are reactive in any
// component that imports them.

export const location = $state({ lat: null, lon: null });

export const sun = $state({
	sunrise: null, // Date | null
	sunset: null,  // Date | null
	daylightDeltaSeconds: null, // number | null — vs yesterday
});

export const spotify = $state({
	data: null,        // raw payload from /spotifyNowPlaying
	progressMs: 0,
	durationMs: 0,
	fetchedAt: 0,      // Date.now() snapshot for tick math
	playing: false,
});

// Visualizer state: the inline canvas (in SpotifyWidget) and the fullscreen
// overlay canvas (in SpotifyVizOverlay) both read from this. SpotifyWidget
// populates `params` when track data arrives; both surfaces share a single
// `startTime` so their motion stays in lockstep.
export const viz = $state({
	params: null,      // { c1, c2, c3, energy, valence, tempo, dance } or null
	startTime: typeof performance !== "undefined" ? performance.now() : 0,
	overlayOpen: false,
});
