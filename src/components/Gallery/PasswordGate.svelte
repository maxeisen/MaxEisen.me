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
    import GateOverlay from "../../lib/ui/GateOverlay.svelte";

    let { scope, password = $bindable(null), title = "Gallery", hint = "Private gallery." } = $props();

    const STORAGE_KEY = `galleryPassword:${scope}`;

    let inputValue = $state("");
    let error = $state("");
    let checking = $state(false);

    onMount(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) password = saved;
        } catch { /* private browsing / disabled storage — fine */ }
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
    <GateOverlay
        {title}
        subtitle={hint}
        inputId="gallery-gate-input"
        bind:value={inputValue}
        {error}
        busy={checking}
        submitLabel="Unlock"
        onsubmit={submit}
    />
{/if}
