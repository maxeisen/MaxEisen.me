<!-- Name entry for a player joining a room. -->
<script>
    let { code, gameTitle = "Story Builder", onJoin } = $props();

    let nameInput = $state("");
    let joining = $state(false);

    async function join(e) {
        e.preventDefault();
        if (joining || !nameInput.trim()) return;
        joining = true;
        try { await onJoin(nameInput.trim()); } finally { joining = false; }
    }
</script>

<form class="card" onsubmit={join}>
    <h1 class="title">{gameTitle}</h1>
    <p class="sub">Room <strong>{code}</strong>. What should we call you?</p>
    <input
        bind:value={nameInput}
        placeholder="Your name (or alias)"
        maxlength="40"
        autocomplete="off"
        required
        disabled={joining}
    />
    <button class="primary" type="submit" disabled={joining || !nameInput.trim()}>
        {joining ? "Joining…" : "I'm in"}
    </button>
</form>
