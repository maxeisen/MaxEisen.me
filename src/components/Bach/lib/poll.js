// Adaptive poll cadence for the bach game loop.
//
// The host/player screens poll bach-state continuously. Polling every 1.5s is
// only worth it during *active* phases where state changes quickly (answers
// arriving, AI generation running, votes landing). In *stable* phases (waiting
// in the lobby, viewing a round's results, a finished game) we back off to cut
// request volume — those phases can sit idle for minutes.
//
// Pure function so the cadence is unit-testable without the DOM/timer loop.

export const POLL_FAST_MS = 1500;   // active: answers / generation / votes
export const POLL_LOBBY_MS = 4000;  // waiting for players to join
export const POLL_RESULTS_MS = 3000; // round results — host may start next round
export const POLL_IDLE_MS = 8000;   // finished game — effectively terminal

export function pollIntervalForPhase(phase) {
	switch (phase) {
		case "writing":
		case "generating":
		case "reveal":
		case "voting":
			return POLL_FAST_MS;
		case "lobby":
			return POLL_LOBBY_MS;
		case "results":
			return POLL_RESULTS_MS;
		case "finished":
			return POLL_IDLE_MS;
		default:
			// Unknown / transitional phases stay responsive.
			return POLL_FAST_MS;
	}
}
