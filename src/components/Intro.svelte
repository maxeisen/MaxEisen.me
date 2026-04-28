<script>
    import { getContext, onMount } from 'svelte';
    import Annotation from 'svelte-rough-notation';
    import ActivityModal from './modals/ActivityModal.svelte';

    const { open } = getContext('simple-modal');

    let annotationsVisible = false;
    let dollars = [];
    let crowns = [];
    let activityIcons = {};

    const rand = (min, max) => Math.random() * (max - min) + min;
    const j = (n, amount = 1.4) => +(n + rand(-amount, amount)).toFixed(2);

    const buildBarPath = () =>
        `M ${j(0, 0.8)} ${j(-11)} Q ${j(0, 1.6)} ${j(0)} ${j(0, 0.8)} ${j(12)}`;

    const buildSPath = () =>
        `M ${j(5.5)} ${j(-7)} C ${j(1)} ${j(-11)}, ${j(-6)} ${j(-9)}, ${j(-6.2)} ${j(-3)} C ${j(-6)} ${j(1)}, ${j(5)} ${j(2)}, ${j(5.2)} ${j(7)} C ${j(5)} ${j(11.5)}, ${j(-2)} ${j(12.5)}, ${j(-6.5)} ${j(9)}`;

    const buildCrownOutline = () =>
        `M ${j(-8, 0.6)} ${j(5)} L ${j(-8, 0.6)} ${j(-3)} L ${j(-6)} ${j(-7)} L ${j(-3)} ${j(0)} L ${j(0)} ${j(-8)} L ${j(3)} ${j(0)} L ${j(6)} ${j(-7)} L ${j(8, 0.6)} ${j(-3)} L ${j(8, 0.6)} ${j(5)}`;

    const buildCrownBand = () =>
        `M ${j(-8, 0.4)} ${j(5)} L ${j(8, 0.4)} ${j(5)}`;

    const buildCrowns = () => {
        const count = 3;
        const spread = 90;
        return Array.from({ length: count }, (_, i) => {
            const baseX = -spread / 2 + (spread / (count - 1)) * i;
            return {
                x: +(baseX + rand(-3, 3)).toFixed(2),
                y: +rand(-3, 3).toFixed(2),
                rot: +rand(-16, 16).toFixed(1),
                scale: +rand(0.85, 1.1).toFixed(2),
                strokeWidth: +rand(1.3, 2.0).toFixed(2),
                delay: +(i * 0.13 + rand(-0.03, 0.03)).toFixed(2),
                outlinePath: buildCrownOutline(),
                bandPath: buildCrownBand(),
            };
        });
    };

    const buildDollars = () => {
        const count = 5;
        const spread = 96;
        return Array.from({ length: count }, (_, i) => {
            const baseX = -spread / 2 + (spread / (count - 1)) * i;
            return {
                x: +(baseX + rand(-2.5, 2.5)).toFixed(2),
                y: +rand(-3, 3).toFixed(2),
                rot: +rand(-20, 20).toFixed(1),
                scale: +rand(0.75, 1.1).toFixed(2),
                strokeWidth: +rand(1.2, 2.0).toFixed(2),
                delay: +(i * 0.1 + rand(-0.03, 0.03)).toFixed(2),
                barPath: buildBarPath(),
                sPath: buildSPath(),
            };
        });
    };

    const iconBuilders = {
        running: () => [
            `M ${j(-1)} ${j(-7)} m -1.8 0 a 1.8 1.8 0 1 0 3.6 0 a 1.8 1.8 0 1 0 -3.6 0`,
            `M ${j(-1)} ${j(-5)} L ${j(1)} ${j(0)}`,
            `M ${j(1)} ${j(0)} L ${j(4)} ${j(2)} L ${j(6)} ${j(6)}`,
            `M ${j(1)} ${j(0)} L ${j(-1)} ${j(4)} L ${j(-3)} ${j(7)}`,
            `M ${j(0)} ${j(-3)} L ${j(4)} ${j(-5)} L ${j(6)} ${j(-3)}`,
            `M ${j(0)} ${j(-3)} L ${j(-3)} ${j(-1)} L ${j(-4)} ${j(2)}`,
        ],
        cycling: () => [
            `M ${j(-5)} ${j(3)} m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`,
            `M ${j(5)} ${j(3)} m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`,
            `M ${j(-5)} ${j(3)} L ${j(0)} ${j(-3)} L ${j(5)} ${j(3)}`,
            `M ${j(0)} ${j(-3)} L ${j(-2)} ${j(-3)}`,
            `M ${j(0)} ${j(-3)} L ${j(3)} ${j(-5)}`,
        ],
        guitar: () => [
            `M ${j(0)} ${j(-2)} C ${j(-3)} ${j(-2)}, ${j(-3.5)} ${j(0.5)}, ${j(-2)} ${j(2)} C ${j(-4)} ${j(3.5)}, ${j(-4)} ${j(7)}, ${j(0)} ${j(7.5)} C ${j(4)} ${j(7)}, ${j(4)} ${j(3.5)}, ${j(2)} ${j(2)} C ${j(3.5)} ${j(0.5)}, ${j(3)} ${j(-2)}, ${j(0)} ${j(-2)} Z`,
            `M ${j(0)} ${j(4.5)} m -1.2 0 a 1.2 1.2 0 1 0 2.4 0 a 1.2 1.2 0 1 0 -2.4 0`,
            `M ${j(0)} ${j(-2)} L ${j(0)} ${j(-9)}`,
            `M ${j(-1.6)} ${j(-9)} L ${j(1.6)} ${j(-9)}`,
        ],
        drone: () => [
            `M ${j(-1.8)} ${j(-1.8)} L ${j(1.8)} ${j(-1.8)} L ${j(1.8)} ${j(1.8)} L ${j(-1.8)} ${j(1.8)} Z`,
            `M ${j(-1.8)} ${j(-1.8)} L ${j(-5)} ${j(-5)}`,
            `M ${j(1.8)} ${j(-1.8)} L ${j(5)} ${j(-5)}`,
            `M ${j(-1.8)} ${j(1.8)} L ${j(-5)} ${j(5)}`,
            `M ${j(1.8)} ${j(1.8)} L ${j(5)} ${j(5)}`,
            `M ${j(-5)} ${j(-5)} m -2 0 a 2 0.5 0 1 0 4 0 a 2 0.5 0 1 0 -4 0`,
            `M ${j(5)} ${j(-5)} m -2 0 a 2 0.5 0 1 0 4 0 a 2 0.5 0 1 0 -4 0`,
            `M ${j(-5)} ${j(5)} m -2 0 a 2 0.5 0 1 0 4 0 a 2 0.5 0 1 0 -4 0`,
            `M ${j(5)} ${j(5)} m -2 0 a 2 0.5 0 1 0 4 0 a 2 0.5 0 1 0 -4 0`,
        ],
        skiing: () => [
            `M ${j(-8)} ${j(7)} L ${j(4)} ${j(-6)}`,
            `M ${j(-5)} ${j(8)} L ${j(7)} ${j(-5)}`,
            `M ${j(-1)} ${j(-4)} L ${j(2)} ${j(8)}`,
            `M ${j(0.5)} ${j(2)} L ${j(3)} ${j(2)}`,
        ],
        hiking: () => [
            `M ${j(-8)} ${j(7)} L ${j(-3)} ${j(-2)} L ${j(0)} ${j(3)} L ${j(4)} ${j(-6)} L ${j(8)} ${j(7)}`,
            `M ${j(2.5)} ${j(-2)} L ${j(4)} ${j(-6)} L ${j(5.5)} ${j(-2)}`,
            `M ${j(5)} ${j(-7)} m -1.6 0 a 1.6 1.6 0 1 0 3.2 0 a 1.6 1.6 0 1 0 -3.2 0`,
        ],
        travelling: () => [
            `M ${j(0)} ${j(0)} m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0`,
            `M ${j(-7)} ${j(0)} L ${j(7)} ${j(0)}`,
            `M ${j(0)} ${j(-7)} C ${j(-3.2)} ${j(-3)}, ${j(-3.2)} ${j(3)}, ${j(0)} ${j(7)}`,
            `M ${j(0)} ${j(-7)} C ${j(3.2)} ${j(-3)}, ${j(3.2)} ${j(3)}, ${j(0)} ${j(7)}`,
        ],
        tech: () => [
            `M ${j(-7)} ${j(-5)} L ${j(7)} ${j(-5)} L ${j(7)} ${j(3)} L ${j(-7)} ${j(3)} Z`,
            `M ${j(-2)} ${j(3)} L ${j(-3)} ${j(6)} L ${j(3)} ${j(6)} L ${j(2)} ${j(3)}`,
            `M ${j(-5)} ${j(6)} L ${j(5)} ${j(6)}`,
            `M ${j(-5)} ${j(-2.5)} L ${j(2)} ${j(-2.5)}`,
            `M ${j(-5)} ${j(0)} L ${j(0)} ${j(0)}`,
        ],
    };

    const buildActivityIcons = () => {
        const icons = {};
        activities.forEach((a, i) => {
            icons[a.icon] = {
                paths: iconBuilders[a.icon](),
                strokeWidth: +rand(1.3, 1.9).toFixed(2),
                rot: +rand(-12, 12).toFixed(1),
                scale: +rand(0.9, 1.05).toFixed(2),
                delay: +(0.1 + i * 0.08).toFixed(2),
            };
        });
        return icons;
    };

    onMount(() => {
        dollars = buildDollars();
        crowns = buildCrowns();
        activityIcons = buildActivityIcons();
        setTimeout(() => {
            annotationsVisible = true;
        }, 250);
    });

    const openActivityModal = (modalProps) => open(ActivityModal, modalProps);

    // Single source of truth for the hobbies sentence: each entry drives the
    // displayed text, click handler/modal, scribble icon, and stagger delay.
    // Reorder this array to reorder everything.
    const activities = [
        {
            label: 'running',
            icon: 'running',
            modal: {
                image: 'run',
                description: 'Running the 2025 <a href="https://www.torontowaterfrontmarathon.com/" rel="noreferrer" target="_blank">Toronto Waterfront Half Marathon</a>'
            }
        },
        {
            label: 'cycling',
            icon: 'cycling',
            modal: {
                image: 'cycle',
                description: 'Riding the 2023 <a href="https://www.rbcgranfondo.com/whistler/" rel="noreferrer" target="_blank">GranFondo Whistler</a></br></br><iframe height=\'160\' width=\'85%\' frameborder=\'0\' allowtransparency=\'true\' scrolling=\'no\' src=\'https://www.strava.com/athletes/92118908/activity-summary/dc478a7fc29bd0ba2e32f9cf7fb702d2f7e31df4\'></iframe>'
            }
        },
        {
            label: 'skiing',
            icon: 'skiing',
            modal: { image: 'ski', description: 'Skiing in Whistler, BC' }
        },
        {
            label: 'hiking',
            icon: 'hiking',
            modal: { image: 'hike', description: 'Hiking in Bergen, Norway' }
        },
        {
            label: 'travelling',
            icon: 'travelling',
            modal: {
                image: 'travel',
                description: 'Post-landing at <a href="https://en.wikipedia.org/wiki/Gustaf_III_Airport" rel="noreferrer" target="_blank">Gustaf III Airport</a> in a DHC-6 Twin Otter'
            }
        },
        {
            label: 'playing guitar',
            icon: 'guitar',
            modal: { image: 'guitar', description: 'Playing guitar... duh' }
        },
        {
            label: 'flying drones',
            icon: 'drone',
            modal: {
                video: 'https://www.youtube.com/embed/fULlZkgpw50?',
                description: 'A promotional spot of the GV70 for <a href="https://www.genesisyorkdale.ca/" rel="noreferrer" target="_blank">Genesis Yorkdale</a>'
            }
        },
        {
            label: 'cool technology',
            icon: 'tech',
            modal: { image: 'frc', description: '2016 FIRST Robotics Competition' },
            separator: ', or tinkering with '
        },
    ];
</script>

<div class="intro-container" id="intro">
    <h1 class="section-title-intro">Who is Max?</h1>
    <div class="intro-paragraph">
        <p class="title-extension">I'm a <span class="nowrap"><Annotation bind:visible={annotationsVisible} type="highlight" color="var(--intro-highlight-colour)">Software Engineer</Annotation></span> at <span class="wealthsimple-wrap"><a class="intro-link" href="https://wealthsimple.com" rel="noreferrer" target="_blank">Wealthsimple</a><svg class="dollar-sprinkle" class:visible={annotationsVisible} viewBox="-60 -26 120 44" aria-hidden="true">{#each dollars as d}<g transform="translate({d.x} {d.y}) rotate({d.rot}) scale({d.scale})" stroke-width={d.strokeWidth} style="--draw-delay: {d.delay}s"><path d={d.barPath} pathLength="1" /><path d={d.sPath} pathLength="1" /></g>{/each}</svg></span>,
        a <span class="nowrap"><Annotation bind:visible={annotationsVisible} type="underline" color="var(--intro-annotation-colour)">Computer Science</Annotation></span> graduate from <span class="queens-wrap"><a class="intro-link" href="https://www.queensu.ca/" rel="noreferrer" target="_blank">Queen's University</a><svg class="crown-sprinkle" class:visible={annotationsVisible} viewBox="-60 -22 120 36" aria-hidden="true">{#each crowns as c}<g transform="translate({c.x} {c.y}) rotate({c.rot}) scale({c.scale})" stroke-width={c.strokeWidth} style="--draw-delay: {c.delay}s"><path d={c.outlinePath} pathLength="1" /><path d={c.bandPath} pathLength="1" /></g>{/each}</svg></span>,
        and someone who genuinely loves what he does - building things that work, work well, and work at scale.</p>

        <p>I've spent the last several years shipping ultra-large-scale, production software across fintech, e-commerce, media, and cloud infrastructure. I think in systems, care about <Annotation bind:visible={annotationsVisible} type="circle" color="var(--intro-annotation-colour)">craft</Annotation>, and thrive in environments where engineers are expected to own their work <span class="nowrap"><Annotation bind:visible={annotationsVisible} type="bracket" brackets={['left', 'right']} padding={[0, 2]} color="var(--intro-annotation-colour)">end to end</Annotation></span>.</p>

        <p class="activities-paragraph">Outside of work, you'll find me {#each activities as a, i}{#if i > 0}{a.separator ?? ', '}{/if}<activity tabindex="0" on:click={() => openActivityModal(a.modal)}>{a.label}{@render activityIcon(a.icon)}</activity>{/each}.</p>

        {#snippet activityIcon(key)}
            {#if activityIcons[key]}
                <svg class="activity-icon" class:visible={annotationsVisible} viewBox="-12 -12 24 24" aria-hidden="true">
                    <g transform="rotate({activityIcons[key].rot}) scale({activityIcons[key].scale})" stroke-width={activityIcons[key].strokeWidth} style="--draw-delay: {activityIcons[key].delay}s">
                        {#each activityIcons[key].paths as p}
                            <path d={p} pathLength="1" />
                        {/each}
                    </g>
                </svg>
            {/if}
        {/snippet}

        <p><a class="intro-link" href="mailto:intro@maxeisen.me" rel="noreferrer" target="_blank">Email me</a> if you want to connect, or check out my <a class="intro-link" href="/resume.html">resume</a> if you're <Annotation bind:visible={annotationsVisible} type="highlight" color="var(--intro-highlight-colour)">recruiting</Annotation>.</p>
    </div>
</div>

<style>
    .section-title-intro {
        margin-top: 10px;
        margin-bottom: 10px;
        text-align: left;
        font-family: 'Fraunces', 'Iowan Old Style', 'Times New Roman', serif;
        font-weight: 600;
        font-optical-sizing: auto;
        letter-spacing: -0.02em;
    }

    .title-extension {
        padding-top: 0;
        margin-top: 0;
    }

    .intro-paragraph {
        font-size: 18px;
        margin-bottom: 30px;
        line-height: 1.5;
    }

    .nowrap {
        white-space: nowrap;
    }

    .intro-paragraph .activities-paragraph {
        line-height: 1.95;
    }

    activity {
        position: relative;
        display: inline-block;
        color: var(--intro-link-colour);
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
    }

    .activity-icon {
        position: absolute;
        left: 50%;
        bottom: calc(100% - 14px);
        transform: translateX(-50%);
        width: 1.5em;
        height: 1.5em;
        overflow: visible;
        pointer-events: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .activity-icon path {
        fill: none;
        stroke: var(--main-green);
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        opacity: 0;
    }

    .activity-icon.visible path {
        animation: sprinkle-draw 0.55s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        animation-delay: var(--draw-delay, 0s);
    }

    @media (prefers-reduced-motion: reduce) {
        .activity-icon.visible path {
            animation: none;
            stroke-dashoffset: 0;
        }
    }

    activity:hover {
        color: var(--main-green);
        cursor: pointer;
    }

    .intro-link {
        font-weight: 400;
        color: var(--intro-link-colour);
    }

    .intro-link:hover {
        color: var(--link-hover-colour);
    }

    .wealthsimple-wrap,
    .queens-wrap {
        position: relative;
        display: inline-block;
    }

    .dollar-sprinkle,
    .crown-sprinkle {
        position: absolute;
        left: 50%;
        bottom: calc(100% - 8px);
        transform: translateX(-50%);
        overflow: visible;
        pointer-events: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .dollar-sprinkle {
        width: 7em;
        height: 1.7em;
    }

    .crown-sprinkle {
        width: 8.5em;
        height: 1.6em;
    }

    .dollar-sprinkle path,
    .crown-sprinkle path {
        fill: none;
        stroke: var(--main-green);
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        opacity: 0;
    }

    .dollar-sprinkle.visible path,
    .crown-sprinkle.visible path {
        animation: sprinkle-draw 0.55s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        animation-delay: var(--draw-delay, 0s);
    }

    @keyframes sprinkle-draw {
        0%   { opacity: 0; stroke-dashoffset: 1; }
        1%   { opacity: 1; stroke-dashoffset: 1; }
        100% { opacity: 1; stroke-dashoffset: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
        .dollar-sprinkle.visible path,
        .crown-sprinkle.visible path {
            animation: none;
            stroke-dashoffset: 0;
        }
    }

    @media only screen and (max-width: 460px) {
        .section-title-intro {
            font-size: 36px;
        }

        .intro-paragraph {
            font-size: 16px;
        }
    }

    @media only screen and (max-width: 860px) {
        .dollar-sprinkle,
        .crown-sprinkle,
        .activity-icon {
            display: none;
        }
    }
</style>
