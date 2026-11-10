// Every widget the dashboard knows about. Adding one is a component plus an
// entry here.
//
//   id           stable key: the saved layout and show/hide choices use it,
//                so don't rename one that has shipped.
//   title        what the Customize list calls it.
//   description  one line under the title there.
//   component    content only — the dashboard supplies the tile around it.
//                One component can back several widgets (Running and Cycling
//                are the same component), told apart by `props`.
//                It gets an `onavailability(ok)` prop: call it with false
//                when there's nothing to show (its feed never loaded) and the
//                dashboard takes the tile out of the grid; true once data
//                arrives brings it back. A widget that always has something
//                to show (the clock) can ignore it.
//   size         {w, h} in grid units. The more a widget has to show, the
//                bigger: 2×2 for the dense ones, 2×1 or 1×2 for the light.
//                Widgets can end up larger than this (the grid grows them
//                into gaps) and must cope with the grid's smallest rows, so
//                each one's compact tiers live in its own container queries.
//   props        passed to the component, for a widget's settings.
//   href         set for a widget that is one big link; the tile becomes an
//                <a> to it.
//   defaultShown false to ship a widget switched off until someone turns it
//                on. Defaults to true.
//
// The order here is the default layout order.

import ClockWidget from "./ClockWidget.svelte";
import GalleryWidget from "./GalleryWidget.svelte";
import WeatherWidget from "./WeatherWidget.svelte";
import ForecastWidget from "./ForecastWidget.svelte";
import SpotifyWidget from "./SpotifyWidget.svelte";
import StravaWidget from "./StravaWidget.svelte";
import TrainingWidget from "./TrainingWidget.svelte";
import RecoveryWidget from "./RecoveryWidget.svelte";
import TrainingWeekWidget from "./TrainingWeekWidget.svelte";
import GithubWidget from "./GithubWidget.svelte";
import HackerNewsWidget from "./HackerNewsWidget.svelte";
import WorldClocksWidget from "./WorldClocksWidget.svelte";

// Ordered so the default set packs without gaps at the common column
// counts: the 2×2s first, then the 2×1s in pairs, the narrow 1×2s together.
export const WIDGETS = [
	{
		id: "clock",
		title: "Clock",
		description: "Time, date, and how far through the day, week and year",
		component: ClockWidget,
		size: { w: 2, h: 2 },
	},
	{
		id: "weather",
		title: "Weather",
		description: "Current conditions, sun and moon",
		component: WeatherWidget,
		size: { w: 2, h: 2 },
	},
	{
		id: "running",
		title: "Running",
		description: "Today's session, last run, fitness and form, race countdown",
		component: TrainingWidget,
		props: { sport: "run" },
		size: { w: 2, h: 2 },
	},
	{
		id: "cycling",
		title: "Cycling",
		description: "Last ride, this week, fitness and form",
		component: TrainingWidget,
		props: { sport: "ride" },
		size: { w: 2, h: 2 },
	},
	{
		id: "spotify",
		title: "Spotify",
		description: "What's playing, with a visualizer",
		component: SpotifyWidget,
		size: { w: 2, h: 1 },
	},
	{
		id: "forecast",
		title: "Forecast",
		description: "The next hours and days, and whether it's a day for a ride",
		component: ForecastWidget,
		size: { w: 2, h: 1 },
	},
	{
		id: "recovery",
		title: "Recovery",
		description: "Last night's sleep, HRV and resting heart rate from Oura",
		component: RecoveryWidget,
		size: { w: 2, h: 1 },
	},
	{
		id: "week",
		title: "This week",
		description: "The week's plan against what was run and ridden",
		component: TrainingWeekWidget,
		size: { w: 2, h: 1 },
	},
	{
		id: "strava",
		title: "Activity",
		description: "Recent activity of every kind from Strava",
		component: StravaWidget,
		size: { w: 2, h: 2 },
	},
	{
		id: "github",
		title: "Code",
		description: "Latest GitHub push and a year of contributions",
		component: GithubWidget,
		size: { w: 2, h: 2 },
	},
	{
		id: "gallery",
		title: "Photos",
		description: "A random shot from the gallery",
		component: GalleryWidget,
		size: { w: 1, h: 2 },
		href: "/gallery",
	},
	{
		id: "hn",
		title: "Hacker News",
		description: "Top stories right now",
		component: HackerNewsWidget,
		size: { w: 1, h: 2 },
	},
	{
		id: "clocks",
		title: "World clocks",
		description: "The time elsewhere",
		component: WorldClocksWidget,
		props: {
			zones: [
				{ zone: "America/Vancouver", label: "Vancouver" },
				{ zone: "Europe/London", label: "London" },
				{ zone: "Asia/Tokyo", label: "Tokyo" },
			],
		},
		size: { w: 2, h: 1 },
		// Off until someone picks it: the zones above are a guess.
		defaultShown: false,
	},
];

export const WIDGETS_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));
