<script>
    let isDark = $state(document.documentElement.getAttribute('data-theme') === 'dark');

    function toggle() {
        if (typeof window.toggleTheme === 'function') {
            window.toggleTheme();
        }
        isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    }
</script>

<button
    class="theme-toggle"
    onclick={toggle}
    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
    <span class="toggle-track">
        <!-- Sun icon -->
        <svg class="icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <!-- Moon icon -->
        <svg class="icon moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <span class="toggle-thumb" class:slide-right={isDark}></span>
    </span>
</button>

<style>
    .theme-toggle {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9998;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .toggle-track {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 50px;
        height: 26px;
        border-radius: 13px;
        background: var(--toggle-bg, rgba(120, 120, 120, 0.3));
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 0 4px;
        position: relative;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .toggle-thumb {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: transform 0.3s ease;
    }

    .toggle-thumb.slide-right {
        transform: translateX(24px);
    }

    .icon {
        width: 14px;
        height: 14px;
        position: relative;
        z-index: 1;
    }

    .sun {
        color: #f59e0b;
    }

    .moon {
        color: #6366f1;
    }

    @media (max-width: 460px) {
        .theme-toggle {
            top: 12px;
            right: 12px;
        }

        .toggle-track {
            width: 44px;
            height: 23px;
            border-radius: 12px;
            padding: 0 3px;
        }

        .toggle-thumb {
            width: 17px;
            height: 17px;
            top: 3px;
            left: 3px;
        }

        .toggle-thumb.slide-right {
            transform: translateX(21px);
        }

        .icon {
            width: 12px;
            height: 12px;
        }
    }
</style>
