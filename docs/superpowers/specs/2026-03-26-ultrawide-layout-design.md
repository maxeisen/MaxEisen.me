# Ultrawide Layout Fix — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Problem

On 21:9 ultrawide monitors (e.g. 3440×1440), the site layout produces a large empty gap between the profile panel and the main content section. This happens because:

- `.profile-section` uses `position: fixed` with `margin-left: 60px`, pinning it near the viewport's left edge
- The CSS grid allocates `0.75fr` (~940px at 3440px wide) to the profile column, but the profile panel itself is ~280px wide — leaving ~560px of dead space
- `.grid-container` has no maximum width, so columns expand indefinitely

Standard displays (up to 2560px wide) are unaffected by this issue and should remain visually unchanged.

## Approach

**Option A — Max-width container + fixed profile repositioning (chosen)**

Cap the grid container at `1800px` and center it on wider viewports. Add a dedicated ultrawide-only media query (`min-width: 2800px`) that shifts the fixed profile's `margin-left` using `calc` so it tracks the centered container's left edge.

This was chosen over:
- **Option B** (cap only the content section): still leaves a gap between profile and content; right side feels wasted
- **Option C** (fixed-pixel profile column + 1fr content): uses the full width but content can become unwieldy wide; more changes required

## Design

### File changed

`public/styles/index.css` — two additions only, no removals or modifications to existing rules.

### Change 1 — Cap the grid container

Add `max-width` and centering margins to the existing `.grid-container` rule:

```css
.grid-container {
    /* existing properties unchanged */
    max-width: 1800px;
    margin-left: auto;
    margin-right: auto;
}
```

This is a non-breaking cap: at any viewport ≤ 1800px the grid fills available width exactly as before.

### Change 2 — Ultrawide breakpoint for fixed profile repositioning

Append a new media query at the end of the file:

```css
@media (min-width: 2800px) {
    .profile-section {
        margin-left: calc((100vw - 1800px) / 2 + 60px);
    }
}
```

**How the calc works:** when the viewport exceeds 1800px, the grid container is centered, meaning its left edge starts at `(100vw - 1800px) / 2` pixels from the viewport left. Adding back the original `60px` offset preserves the profile's position within its column.

This breakpoint (`2800px`) is chosen to be safely above all common 16:9 resolutions:
- 1920×1080 (Full HD) — unaffected ✓
- 2560×1440 (1440p) — unaffected ✓
- 3440×1440 (21:9 ultrawide) — fixed ✓

## Constraints

- No changes to existing breakpoints (860px, 1100px, 1270px, 1540px)
- No changes to any component files
- Profile `position: fixed` behavior (always visible while scrolling) is preserved
- Mobile and tablet layouts are completely unaffected
