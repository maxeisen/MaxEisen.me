<!--
    Renders a join QR as a data-URL <img>. The encoded URL carries both the
    room code and the password (?room=CODE&k=PASSWORD) so scanning players are
    authenticated transparently without typing anything.
-->
<script>
    import QRCode from "qrcode";

    let { text, size = 240 } = $props();

    let dataUrl = $state("");
    let failed = $state(false);

    $effect(() => {
        const value = text;
        if (!value) { dataUrl = ""; return; }
        let cancelled = false;
        QRCode.toDataURL(value, {
            width: size,
            margin: 1,
            color: { dark: "#1c1a17", light: "#f0e7d6" },
            errorCorrectionLevel: "M",
        })
            .then((url) => { if (!cancelled) { dataUrl = url; failed = false; } })
            .catch(() => { if (!cancelled) failed = true; });
        return () => { cancelled = true; };
    });
</script>

{#if dataUrl}
    <img class="bach-qr" src={dataUrl} alt="Scan to join" width={size} height={size} />
{:else if failed}
    <div class="bach-qr-fallback">QR unavailable — type the code instead.</div>
{/if}

<style>
    .bach-qr {
        display: block;
        border-radius: 12px;
        background: #f0e7d6;
        padding: 0.5rem;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
    }
    .bach-qr-fallback {
        font-size: 0.85rem;
        opacity: 0.7;
        max-width: 16ch;
        text-align: center;
    }
</style>
