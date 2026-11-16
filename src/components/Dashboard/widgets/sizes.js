// The sizes each dashboard widget offers, in grid units ({w, h}), and which
// one it starts at. Kept apart from registry.js (which imports the Svelte
// components) so plain-JS tests can check it.
//
// Small, Medium and Large are about how much a widget shows, not a fixed
// cell count: each widget's own container queries decide what fits at each
// size. A widget whose bigger tile would show nothing new offers fewer sizes.
// Every size must still look right on the grid's shortest rows (64px), so
// check a new one at small window sizes (e2e/dashboard.e2e.js).

export const WIDGET_SIZES = {
	// S: time and date. M: plus compact progress. L: every progress bar.
	clock: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	// S: temperature and conditions. M: plus stats. L: plus sun and moon.
	weather: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "l" },
	// S: today's session or last run. L: two columns and the fitness chart.
	running: { sizes: { s: { w: 2, h: 1 }, m: { w: 2, h: 2 }, l: { w: 3, h: 2 } }, defaultSize: "l" },
	cycling: { sizes: { s: { w: 2, h: 1 }, m: { w: 2, h: 2 }, l: { w: 3, h: 2 } }, defaultSize: "m" },
	// S: the current track. L: plus recently played.
	spotify: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	// S: ride verdict and a few hours. L: plus the days ahead.
	forecast: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	// S: score and two readings. L: all four, with notes.
	recovery: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	// S: short day labels. L: plan and done for each day, with room.
	week: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	// S: a few activities, no maps. M: plus the year so far. L: about twice as many.
	strava: { sizes: { s: { w: 1, h: 2 }, m: { w: 2, h: 2 }, l: { w: 2, h: 3 } }, defaultSize: "m" },
	// S: latest push. M: plus a shorter contribution graph. L: the full graph.
	github: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	gallery: { sizes: { s: { w: 1, h: 1 }, m: { w: 1, h: 2 }, l: { w: 2, h: 2 } }, defaultSize: "m" },
	// S: titles. M: plus vote scores. L: more stories.
	hn: { sizes: { s: { w: 1, h: 2 }, m: { w: 2, h: 2 }, l: { w: 2, h: 3 } }, defaultSize: "m" },
	// S: two cities. A bigger tile would show nothing new.
	clocks: { sizes: { s: { w: 1, h: 1 }, m: { w: 2, h: 1 } }, defaultSize: "m" },
};
