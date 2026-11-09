<!--
    Light/dark switch. Sits in SiteNav; the actual theme change is
    window.toggleTheme from index.html, which also keeps the browser chrome
    colour in step.
-->
<script>
    import { onMount } from "svelte";

    const read = () =>
        typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";

    let isDark = $state(read());

    function toggle() {
        window.toggleTheme?.();
        isDark = read();
    }

    // index.html follows the system setting; mirror it so the icon stays right.
    onMount(() => {
        const observer = new MutationObserver(() => (isDark = read()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        return () => observer.disconnect();
    });
</script>

<button
    class="theme-toggle"
    type="button"
    onclick={toggle}
    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    title={isDark ? "Light mode" : "Dark mode"}
>
    {#if isDark}
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.25" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
    {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
    {/if}
</button>

<style>
    .theme-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 0;
        border-radius: var(--radius);
        background: transparent;
        color: var(--text-2);
        cursor: pointer;
        transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
        -webkit-tap-highlight-color: transparent;
    }
    .theme-toggle:hover { color: var(--text-strong); background: var(--surface-2); }
    svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
</style>
