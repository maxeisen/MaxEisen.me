export function tilt(node, options = {}) {
    const { max = 6, scale = 1.02, perspective = 900 } = options;

    if (typeof window === 'undefined') return {};
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
    if (window.matchMedia('(pointer: coarse)').matches) return {};

    let raf = 0;
    let pending = null;

    const apply = () => {
        raf = 0;
        if (!pending) return;
        const { rx, ry } = pending;
        node.style.transform = `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
        pending = null;
    };

    const onMove = (e) => {
        const rect = node.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        pending = { rx: -py * max, ry: px * max };
        if (!raf) raf = requestAnimationFrame(apply);
    };

    const onLeave = () => {
        if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
        node.style.transform = '';
    };

    const prevTransition = node.style.transition;
    node.style.transition = 'transform 0.18s ease-out';
    node.style.willChange = 'transform';

    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);

    return {
        destroy() {
            if (raf) cancelAnimationFrame(raf);
            node.removeEventListener('mousemove', onMove);
            node.removeEventListener('mouseleave', onLeave);
            node.style.transition = prevTransition;
            node.style.willChange = '';
            node.style.transform = '';
        }
    };
}
