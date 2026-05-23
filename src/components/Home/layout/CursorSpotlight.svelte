<script>
    import { onMount } from 'svelte';

    let spotlight;
    let visible = false;

    onMount(() => {
        if (window.matchMedia('(pointer: coarse)').matches) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let tx = window.innerWidth / 2;
        let ty = window.innerHeight / 2;
        let x = tx;
        let y = ty;
        let raf;

        const onMove = (e) => {
            tx = e.clientX;
            ty = e.clientY;
            if (!visible) visible = true;
        };

        const onLeave = () => {
            visible = false;
        };

        const tick = () => {
            x += (tx - x) * 0.18;
            y += (ty - y) * 0.18;
            if (spotlight) {
                spotlight.style.transform = `translate3d(${x - 250}px, ${y - 250}px, 0)`;
            }
            raf = requestAnimationFrame(tick);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseleave', onLeave);
        tick();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseleave', onLeave);
        };
    });
</script>

<div class="cursor-spotlight" class:visible bind:this={spotlight} aria-hidden="true"></div>

<style>
    .cursor-spotlight {
        position: fixed;
        top: 0;
        left: 0;
        width: 500px;
        height: 500px;
        border-radius: 50%;
        background: radial-gradient(
            circle at 50% 50%,
            var(--main-green) 0%,
            transparent 60%
        );
        opacity: 0;
        pointer-events: none;
        z-index: 9998;
        mix-blend-mode: plus-lighter;
        will-change: transform, opacity;
        transition: opacity 0.4s ease-out;
        filter: blur(40px);
    }

    .cursor-spotlight.visible {
        opacity: 0.12;
    }

    @media (prefers-reduced-motion: reduce) {
        .cursor-spotlight { display: none; }
    }

    @media (pointer: coarse) {
        .cursor-spotlight { display: none; }
    }
</style>
