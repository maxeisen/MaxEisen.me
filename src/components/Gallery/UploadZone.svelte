<!--
    Drag-and-drop / click-to-pick upload zone.

    Browser hits `/.netlify/functions/signCloudinaryUpload` to mint a
    short-lived signed payload (scoped to the current scope's tag), then
    POSTs each file directly to Cloudinary. Tag and folder are baked into
    the signed params, so the browser can't widen them.

    Identity: we ask for the uploader's name once per session (stored in
    sessionStorage under `gallery-uploader:${scope}`) and pass it to the
    signing function, which sanitizes it into a public_id_prefix baked
    into the signed params. Cloudinary then names every uploaded photo
    `<slug>_<random>`, so downloads carry the uploader's name in the
    filename without per-file signing roundtrips.

    Emits `onuploaded` (callback prop) when the batch finishes — the parent
    decides what to do (typically: refetch the photo list).

    Auth fail (401 from the signing function) emits `onauthfail`, so the
    parent can clear the saved password and re-show the gate.
-->
<script>
    let {
        scope,
        password,
        onuploaded,
        onauthfail,
    } = $props();

    const uploaderKey = `gallery-uploader:${scope}`;

    let dragover = $state(false);
    let busy = $state(false);
    let status = $state("");
    let statusError = $state(false);
    let inputRef = $state();

    // Name persistence — load from sessionStorage on mount.
    let uploaderName = $state("");
    let nameDraft = $state("");
    let editingName = $state(false);

    if (typeof window !== "undefined") {
        try {
            const saved = sessionStorage.getItem(uploaderKey);
            if (saved) uploaderName = saved;
        } catch {}
    }

    function saveName() {
        const trimmed = nameDraft.trim();
        if (!trimmed) return;
        uploaderName = trimmed;
        editingName = false;
        try { sessionStorage.setItem(uploaderKey, trimmed); } catch {}
    }

    function startEdit() {
        nameDraft = uploaderName;
        editingName = true;
    }

    function setStatus(text, isError = false) {
        status = text || "";
        statusError = isError;
    }

    async function fetchSignature() {
        const res = await fetch("/.netlify/functions/signCloudinaryUpload", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Gallery-Password": password || "",
            },
            body: JSON.stringify({ scope, uploader: uploaderName }),
        });
        if (!res.ok) {
            if (res.status === 401) onauthfail?.();
            throw new Error(`signature ${res.status}`);
        }
        return res.json();
    }

    async function uploadFiles(fileList) {
        const images = [...fileList].filter((f) => f.type.startsWith("image/"));
        if (!images.length) return;
        if (!uploaderName) {
            setStatus("Please enter your name first so we can credit the upload.", true);
            return;
        }
        let signed;
        try {
            signed = await fetchSignature();
        } catch (err) {
            setStatus(err.message === "signature 401" ? "Session expired." : "Could not authorize upload.", true);
            return;
        }
        busy = true;
        let done = 0;
        let failed = 0;
        for (const file of images) {
            setStatus(`Uploading ${done + failed + 1}/${images.length}…`);
            const fd = new FormData();
            fd.append("file", file);
            fd.append("api_key", signed.api_key);
            fd.append("timestamp", signed.timestamp);
            fd.append("signature", signed.signature);
            fd.append("folder", signed.folder);
            fd.append("tags", signed.tags);
            if (signed.public_id_prefix) {
                fd.append("public_id_prefix", signed.public_id_prefix);
            }
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloud_name}/image/upload`, {
                    method: "POST",
                    body: fd,
                });
                if (res.ok) done++; else failed++;
            } catch {
                failed++;
            }
        }
        busy = false;
        if (failed > 0 && done === 0) {
            setStatus(`Upload failed (${failed}/${images.length}). Try again.`, true);
            if (inputRef) inputRef.value = "";
            return;
        }
        const summary = failed > 0
            ? `Uploaded ${done}/${images.length} (${failed} failed).`
            : `Uploaded ${done} photo${done === 1 ? "" : "s"}.`;
        setStatus(summary);
        onuploaded?.({ uploaded: done, failed });
    }

    function pick() {
        if (!uploaderName) {
            editingName = true;
            return;
        }
        inputRef?.click();
    }
    function onInputChange(e) { uploadFiles(e.target.files); }
    function onDragover(e) { e.preventDefault(); dragover = true; }
    function onDragleave(e) {
        // Only clear when leaving the wrapper, not a child element.
        if (e.target === e.currentTarget) dragover = false;
    }
    function onDrop(e) {
        e.preventDefault();
        dragover = false;
        if (!uploaderName) {
            editingName = true;
            setStatus("Please enter your name first so we can credit the upload.", true);
            return;
        }
        uploadFiles(e.dataTransfer?.files || []);
    }

    function onNameKey(e) {
        if (e.key === "Enter") { e.preventDefault(); saveName(); }
        else if (e.key === "Escape") { editingName = false; nameDraft = ""; }
    }
</script>

<div
    class="upload-zone"
    class:dragover
    ondragover={onDragover}
    ondragleave={onDragleave}
    ondrop={onDrop}
    role="region"
    aria-label="Photo upload area"
>
    <input
        bind:this={inputRef}
        onchange={onInputChange}
        type="file"
        accept="image/*"
        multiple
        hidden
        disabled={busy}
    />

    {#if !uploaderName || editingName}
        <div class="uploader-name-field">
            <label for={`uploader-${scope}`}>What's your name? <span class="uploader-hint">we'll credit your uploads</span></label>
            <div class="uploader-name-row">
                <input
                    id={`uploader-${scope}`}
                    type="text"
                    bind:value={nameDraft}
                    onkeydown={onNameKey}
                    placeholder="e.g. Max"
                    autocomplete="given-name"
                    maxlength="32"
                />
                <button type="button" class="uploader-save" onclick={saveName} disabled={!nameDraft.trim()}>save</button>
            </div>
        </div>
    {:else}
        <p class="upload-prompt">
            Drag &amp; drop photos here, or <button type="button" class="upload-pick" onclick={pick} disabled={busy}>pick files</button>.
        </p>
        <p class="uploader-credit">
            Uploading as <strong>{uploaderName}</strong> · <button type="button" class="uploader-edit" onclick={startEdit}>change</button>
        </p>
    {/if}

    {#if status}
        <div class="upload-status" class:error={statusError}>{status}</div>
    {/if}
</div>

<style>
    .upload-zone {
        max-width: 60ch;
        /* Margin-top keeps the zone clear of the masonry grid above —
           column heights stagger, so without it the bottom-most figures
           can crowd the dashed border. */
        margin: 3rem auto 2.5rem auto;
        padding: 1.25rem 1.5rem;
        border: 2px dashed var(--main-green-translucent);
        border-radius: 14px;
        text-align: center;
        color: var(--paragraph-colour);
        background: rgba(255, 255, 255, 0.015);
        transition: border-color 0.15s ease, background 0.15s ease;
    }
    .upload-zone.dragover {
        border-color: var(--main-green);
        background: var(--main-green-translucent);
    }
    .upload-prompt {
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.45;
        opacity: 0.85;
    }
    .upload-pick {
        font: inherit;
        font-weight: 600;
        color: var(--main-green);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-style: dotted;
        text-underline-offset: 3px;
    }
    .upload-pick:hover { color: var(--header-colour); }
    .upload-pick:disabled { opacity: 0.5; cursor: progress; }

    .uploader-credit {
        margin: 0.45rem 0 0 0;
        font-size: 0.78rem;
        color: var(--paragraph-colour);
        opacity: 0.6;
    }
    .uploader-credit strong { color: var(--main-green); font-weight: 600; }
    .uploader-edit {
        font: inherit;
        color: inherit;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-style: dotted;
        text-underline-offset: 2px;
    }
    .uploader-edit:hover { color: var(--main-green); opacity: 1; }

    .uploader-name-field {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    .uploader-name-field label {
        font-size: 0.85rem;
        color: var(--paragraph-colour);
        opacity: 0.85;
    }
    .uploader-hint {
        font-size: 0.72rem;
        color: var(--paragraph-colour);
        opacity: 0.55;
        margin-left: 0.25rem;
    }
    .uploader-name-row {
        display: flex;
        gap: 0.5rem;
        max-width: 22rem;
        width: 100%;
    }
    .uploader-name-row input {
        flex: 1;
        font: inherit;
        font-size: 0.95rem;
        padding: 0.5rem 0.75rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--main-green-translucent);
        border-radius: 8px;
        color: var(--header-colour);
        outline: none;
        transition: border-color 0.15s ease, background 0.15s ease;
    }
    .uploader-name-row input:focus {
        border-color: var(--main-green);
        background: rgba(255, 255, 255, 0.06);
    }
    .uploader-save {
        font: inherit;
        font-weight: 600;
        font-size: 0.85rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--background-one, #1c1a17);
        background: var(--main-green);
        border: none;
        padding: 0 1rem;
        border-radius: 8px;
        cursor: pointer;
        transition: opacity 0.15s ease;
    }
    .uploader-save:disabled { opacity: 0.35; cursor: not-allowed; }

    .upload-status {
        margin-top: 0.6rem;
        font-size: 0.82rem;
        color: var(--main-green);
        opacity: 0.9;
    }
    .upload-status.error { color: #d97777; }
</style>
