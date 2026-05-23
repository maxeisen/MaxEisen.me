<!--
    Password gate overlay for the per-scope (ride / run / etc.) galleries.

    Owned state: the input value + transient error / loading flags.
    Owned side effects: POST to /.netlify/functions/checkGalleryPassword,
        and persist the accepted password in sessionStorage so refreshing
        the page doesn't re-prompt.

    Bindable: `password` — the parent reads this to decide when to actually
    fetch the photo list. When null the gate is shown; when set the gate is
    hidden and the parent runs.
-->
<script>
    import { onMount } from "svelte";

    let { scope, password = $bindable(null), title = "Gallery", hint = "Friends-only gallery." } = $props();

    const STORAGE_KEY = `galleryPassword:${scope}`;

    let inputValue = $state("");
    let error = $state("");
    let checking = $state(false);
    let inputRef;

    onMount(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) password = saved;
        } catch { /* private browsing / disabled storage — fine */ }
        if (!password) {
            // requestAnimationFrame so the focus lands after the gate renders.
            requestAnimationFrame(() => inputRef?.focus());
        }
    });

    async function submit(e) {
        e.preventDefault();
        if (checking) return;
        error = "";
        checking = true;
        try {
            const res = await fetch("/.netlify/functions/checkGalleryPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope, password: inputValue }),
            });
            if (!res.ok) {
                error = res.status === 401 ? "Wrong password." : "Service unavailable. Try again later.";
                return;
            }
            try { sessionStorage.setItem(STORAGE_KEY, inputValue); } catch {}
            password = inputValue;
        } catch {
            error = "Network error. Try again.";
        } finally {
            checking = false;
        }
    }
</script>

{#if !password}
    <div class="gallery-gate" role="dialog" aria-modal="true">
        <form class="gallery-gate-form" onsubmit={submit}>
            <h1 class="gallery-gate-title">{title}</h1>
            <p class="gallery-gate-sub">{hint}</p>
            <label for="gallery-gate-input">Password</label>
            <input
                bind:this={inputRef}
                bind:value={inputValue}
                id="gallery-gate-input"
                type="password"
                autocomplete="off"
                required
                disabled={checking}
            />
            <button type="submit" disabled={checking || !inputValue}>
                {checking ? "Checking…" : "Unlock"}
            </button>
            {#if error}<div class="gallery-gate-error">{error}</div>{/if}
        </form>
    </div>
{/if}

<style>
    .gallery-gate {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(28, 26, 23, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }
    .gallery-gate-form {
        min-width: min(360px, 92vw);
        padding: 1.75rem 2rem;
        border-radius: 16px;
        background: var(--background-one);
        border: 1px solid var(--main-green-translucent);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }
    .gallery-gate-title {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 1.6rem;
        letter-spacing: -0.02em;
        color: var(--header-colour);
        margin: 0;
    }
    .gallery-gate-sub {
        font-size: 0.88rem;
        color: var(--paragraph-colour);
        opacity: 0.8;
        margin: 0;
    }
    label {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--main-green);
    }
    input {
        font: inherit;
        color: var(--header-colour);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--main-green-translucent);
        border-radius: 8px;
        padding: 0.55rem 0.75rem;
        outline: none;
        transition: border-color 0.15s ease, background 0.15s ease;
    }
    input:focus {
        border-color: var(--main-green);
        background: rgba(255, 255, 255, 0.06);
    }
    button {
        font: inherit;
        font-weight: 600;
        color: var(--background-one);
        background: var(--main-green);
        border: none;
        border-radius: 8px;
        padding: 0.6rem 1rem;
        cursor: pointer;
        transition: opacity 0.15s ease, transform 0.1s ease;
    }
    button:hover:not(:disabled) { opacity: 0.92; }
    button:active:not(:disabled) { transform: scale(0.97); }
    button:disabled { opacity: 0.5; cursor: progress; }
    .gallery-gate-error {
        font-size: 0.82rem;
        color: #d97777;
    }
</style>
