<script>
    import { onMount } from 'svelte';

    let isDark = $state(document.documentElement.getAttribute('data-theme') === 'dark');

    function toggle() {
        if (typeof window.toggleTheme === 'function') {
            window.toggleTheme();
        }
        isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    }

    onMount(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        function onSystemChange(e) {
            // Only follow system if the user hasn't manually set a preference
            if (!localStorage.getItem('theme')) {
                const theme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', theme);
                isDark = e.matches;
            } else {
                isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            }
        }
        mq.addEventListener('change', onSystemChange);
        return () => mq.removeEventListener('change', onSystemChange);
    });
</script>

<button
    class="theme-toggle"
    onclick={toggle}
    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
    {#if isDark}
        <!-- Sun: switch to light -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
    {:else}
        <!-- Moon: switch to dark -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
    {/if}
</button>

<style>
    .theme-toggle {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9998;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(120, 120, 120, 0.25);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        color: var(--text-primary, currentColor);
        -webkit-tap-highlight-color: transparent;
        transition: background 0.2s ease, transform 0.1s ease;
    }

    .theme-toggle:hover {
        background: rgba(120, 120, 120, 0.4);
    }

    .theme-toggle:active {
        transform: scale(0.92);
    }

    .theme-toggle svg {
        width: 18px;
        height: 18px;
    }

    @media (max-width: 460px) {
        .theme-toggle {
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
        }

        .theme-toggle svg {
            width: 16px;
            height: 16px;
        }
    }
</style>
