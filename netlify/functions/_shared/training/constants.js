// Numbers the engine and the page have to agree on.
//
// Kept in a module with no other imports so the UI can read them without
// pulling the rest of the training engine into the browser bundle.

/** Trailing window every training chart draws, in weeks. */
export const CHART_WEEKS = 12;

/** Same window in days — the efficiency headline and the charts share this. */
export const CHANGE_WINDOW_DAYS = CHART_WEEKS * 7;

/** Sleep below this, as a weekly average, is where injury-risk evidence starts. */
export const SLEEP_TARGET_SEC = 7 * 3600;

/** Overnight RHR this far above baseline is past night-to-night noise. */
export const RHR_RISE_BPM = 5;

/** Seven-day HRV this far below the monthly baseline, as a percent. */
export const HRV_DROP_PCT = 15;

/** Injury-risk corridor for acute:chronic workload. Below = detraining. */
export const ACWR_FLOOR = 0.8;

/** Injury-risk corridor for acute:chronic workload. Above = ramping too fast. */
export const ACWR_CEILING = 1.5;
