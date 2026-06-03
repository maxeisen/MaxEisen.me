// Shared narration playback state. The <audio> element lives in NarrationPlayer
// (kept mounted across reveal → voting so playback never cuts out); the reveal
// story view reads progress from here to drive its auto-scroll, without the two
// components having to live in the same file.
export const narration = $state({
	currentTime: 0,
	duration: 0,
	playing: false,
});

export function resetNarration() {
	narration.currentTime = 0;
	narration.duration = 0;
	narration.playing = false;
}
