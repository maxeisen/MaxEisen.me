<!--
    Drag-and-drop / click-to-pick upload zone.

    Browser hits `/.netlify/functions/signCloudinaryUpload` to mint a
    short-lived signed payload (scoped to the current scope's tag), then
    POSTs each file directly to Cloudinary. Tag and folder are baked into
    the signed params, so the browser can't widen them.

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

    let dragover = $state(false);
    let busy = $state(false);
    let status = $state("");
    let statusError = $state(false);
    let inputRef;

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
            body: JSON.stringify({ scope }),
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

    function pick() { inputRef?.click(); }
    function onInputChange(e) { uploadFiles(e.target.files); }
    function onDragover(e) { e.preventDefault(); dragover = true; }
    function onDragleave(e) {
        // Only clear when leaving the wrapper, not a child element.
        if (e.target === e.currentTarget) dragover = false;
    }
    function onDrop(e) {
        e.preventDefault();
        dragover = false;
        uploadFiles(e.dataTransfer?.files || []);
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
    <p class="upload-prompt">
        Drag &amp; drop photos here, or <button type="button" class="upload-pick" onclick={pick} disabled={busy}>pick files</button>. They'll upload tagged for this gallery.
    </p>
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
    .upload-status {
        margin-top: 0.6rem;
        font-size: 0.82rem;
        color: var(--main-green);
        opacity: 0.9;
    }
    .upload-status.error { color: #d97777; }
</style>
