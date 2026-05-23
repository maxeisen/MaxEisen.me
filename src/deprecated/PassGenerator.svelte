<script>
    import { onMount } from "svelte";

    let name = $state("");
    let title = $state("");
    let email = $state("");
    let photoUrl = $state("");
    let loading = $state(false);
    let error = $state("");
    let successMessage = $state("");
    let storedPassword = $state(null);
    let passwordInput = $state("");
    let passwordError = $state("");
    let passwordChecking = $state(false);

    onMount(() => {
        if (typeof sessionStorage !== "undefined") {
            const p = sessionStorage.getItem("passGeneratorPassword");
            if (p) storedPassword = p;
        }
    });

    async function handlePasswordSubmit(e) {
        e.preventDefault();
        passwordError = "";
        passwordChecking = true;
        try {
            const res = await fetch("/.netlify/functions/checkPassGeneratorPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: passwordInput }),
            });
            if (!res.ok) {
                passwordError = "Wrong password.";
                return;
            }
            if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem("passGeneratorPassword", passwordInput);
            }
            storedPassword = passwordInput;
        } catch {
            passwordError = "Something went wrong.";
        } finally {
            passwordChecking = false;
        }
    }

    function lock() {
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem("passGeneratorPassword");
        }
        storedPassword = null;
        passwordInput = "";
        error = "";
        successMessage = "";
    }

    async function handleSubmit() {
        error = "";
        successMessage = "";
        loading = true;
        try {
            const res = await fetch("/.netlify/functions/generatePass", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Pass-Generator-Password": storedPassword || "",
                },
                body: JSON.stringify({ name, title, email, photoUrl }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 401) {
                    lock();
                    return;
                }
                error = data.error || "Something went wrong.";
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "pass.pkpass";
            a.click();
            URL.revokeObjectURL(url);
            successMessage = "Download started.";
        } catch (e) {
            error = "Something went wrong.";
        } finally {
            loading = false;
        }
    }
</script>

<div class="pass-generator-page">
    <h1>Wallet pass generator</h1>

    {#if storedPassword}
    <p>Create an Apple Wallet business card pass from your name, title, and photo.</p>
    <p class="pass-meta"><button type="button" class="pass-lock" onclick={lock}>Lock</button> — use this to require the password again.</p>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="pass-form">
        <label for="pass-name">Name</label>
        <input id="pass-name" type="text" bind:value={name} required disabled={loading} />

        <label for="pass-title">Title</label>
        <input id="pass-title" type="text" bind:value={title} required disabled={loading} />

        <label for="pass-email">Email (optional)</label>
        <input id="pass-email" type="email" bind:value={email} disabled={loading} placeholder="you@example.com" />

        <label for="pass-photo">Photo URL</label>
        <input id="pass-photo" type="url" bind:value={photoUrl} required disabled={loading} placeholder="https://..." />

        {#if error}
            <p class="pass-error" role="alert">{error}</p>
        {/if}
        {#if successMessage}
            <p class="pass-success">{successMessage}</p>
        {/if}

        <button type="submit" disabled={loading}>
            {loading ? "Generating…" : "Generate pass"}
        </button>
    </form>
    {:else}
    <p>Enter the password to use this tool.</p>
    <form onsubmit={handlePasswordSubmit} class="pass-form pass-gate">
        <label for="pass-gate-password">Password</label>
        <input
            id="pass-gate-password"
            type="password"
            bind:value={passwordInput}
            disabled={passwordChecking}
            autocomplete="current-password"
        />
        {#if passwordError}
            <p class="pass-error" role="alert">{passwordError}</p>
        {/if}
        <button type="submit" disabled={passwordChecking}>
            {passwordChecking ? "Checking…" : "Continue"}
        </button>
    </form>
    {/if}

    <p><a href="/">← Home</a></p>
</div>

<style>
    .pass-generator-page {
        padding: 2rem;
        max-width: 40rem;
        margin: 0 auto;
    }
    .pass-generator-page h1 {
        font-size: 1.75rem;
        margin-bottom: 0.5rem;
        color: var(--header-colour, inherit);
    }
    .pass-generator-page > p {
        margin-bottom: 1rem;
        color: var(--paragraph-colour, inherit);
    }
    .pass-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }
    .pass-form label {
        font-weight: 600;
        color: var(--header-colour, inherit);
    }
    .pass-form input {
        padding: 0.5rem;
        font-size: 1rem;
        border: var(--item-border, 1px solid #8a8989);
        border-radius: 4px;
        background: var(--inner-background, #fff);
        color: var(--paragraph-colour, inherit);
    }
    .pass-form button {
        padding: 0.6rem 1rem;
        font-size: 1rem;
        cursor: pointer;
        background: var(--main-green, #00806f);
        color: white;
        border: none;
        border-radius: 4px;
        margin-top: 0.25rem;
    }
    .pass-form button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    .pass-error {
        color: #c00;
        margin: 0;
    }
    .pass-success {
        color: var(--main-green, #00806f);
        margin: 0;
    }
    .pass-meta {
        font-size: 0.9rem;
        color: var(--item-small-text, #666);
        margin-bottom: 1rem;
    }
    .pass-lock {
        background: none;
        border: none;
        padding: 0;
        font-size: inherit;
        cursor: pointer;
        color: var(--intro-link-colour, #0066cc);
        text-decoration: underline;
    }
    .pass-gate {
        max-width: 20rem;
    }
    .pass-generator-page a {
        color: var(--intro-link-colour, #0066cc);
    }
</style>
