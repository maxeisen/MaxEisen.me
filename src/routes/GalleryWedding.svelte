<!--
    /gallery/wedding — TRULY private gallery.

    Photos are uploaded to Cloudinary as `authenticated` delivery type, so
    they can't be reached by URL or enumerated by tag. The `signed` prop
    makes Gallery fetch from signedGalleryList (password-gated, returns
    per-photo signed URLs) instead of the public galleryList. No uploads
    from the site. noindex so the page never shows up in search.
-->
<script>
    import Gallery from "../components/Gallery/Gallery.svelte";

    // Scene filter chips — displayed in this order, but only for scenes that
    // actually have photos tagged `scene:<slug>` in Cloudinary. Reorder / add
    // / rename freely; the slug is the Cloudinary tag suffix.
    // People filter display order (slugs). Unlisted people fall to the end.
    const peopleOrder = [
        "lara", "max", "michael", "robin", "elan", "rosanne", "jen", "stephanie",
        "daniel", "tasha", "holden", "hayley", "kai", "ryland", "judianne",
        "maverick", "beau", "suzanne", "gavin", "marty-ez", "jane", "alex",
        "sarah", "olivia-d", "olivia-f", "laura", "judy", "gabi", "matthew-p",
        "andrew", "dakota", "matthew-g", "lewis",
    ];

    const scenes = [
        { slug: "getting-ready", label: "Getting Ready" },
        { slug: "reveal", label: "Reveal" },
        { slug: "plum", label: "Plum" },
        { slug: "rooftop", label: "Rooftop" },
        { slug: "street", label: "Street" },
        { slug: "bridesmaids", label: "Bridesmaids" },
        { slug: "groomsmen", label: "Groomsmen" },
        { slug: "family", label: "Family" },
        { slug: "tisch", label: "Tisch" },
        { slug: "bedeken", label: "Bedeken" },
        { slug: "ceremony", label: "Ceremony" },
        { slug: "reception", label: "Reception" },
        { slug: "cocktails", label: "Cocktails" },
        { slug: "party", label: "Party" },
        { slug: "speeches", label: "Speeches" },
        { slug: "flowers", label: "Flowers" },
        { slug: "first-dance", label: "First Dance" },
        { slug: "film", label: "Film" },
    ];
</script>

<svelte:head>
    <title>Wedding | MaxEisen.me</title>
    <meta name="robots" content="noindex"/>
    <link rel="canonical" href="https://maxeisen.me/gallery/wedding"/>
</svelte:head>

<Gallery
    tag="wedding"
    title="Max and Lara's Wedding"
    sort="captured-asc"
    passwordScope="wedding"
    signed
    bulkDownloadEnabled
    faceFilter
    {peopleOrder}
    {scenes}
>
    {#snippet intro()}
        <p>Photos from Max and Lara's wedding day - a private gallery for family and friends.</p>
        <p><strong>Find your photos fast.</strong> Use the filters above the grid: tap a face to see photos of that person, tap a scene (Ceremony, Party, Family…) to jump to that moment, or combine the two. Select a few people and toggle <em>Any</em>/<em>All</em> to switch between "in any of their photos" and "only together."</p>
        <p>Tap any photo to view it full-screen, start a slideshow, or select photos to download (individually or in bulk).</p>
    {/snippet}
</Gallery>
