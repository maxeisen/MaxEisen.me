<script>
    import { marked } from 'marked'

    export let id;
    export let title;
    export let author;
    export let date;
    export let updated;
    export let content;

    const postUrl = `https://maxeisen.me/blog/${id}`; // fake URL for storing claps
    var postContent = "Loading..."
    
    fetch(`../content/blog/${content}.md`)
        .then(content => content.text())
        .then(data => {
            postContent = data;
            }
        );
</script>

<div class="blog-modal">
    <div class="blog-header">
        <h1 class="blog-title" style="text-align: center">{title}</h1>
        <h3 class="blog-author" style="text-align: center">Author: <b class="author-name">{author}</b></h3>
        <h3 class="blog-date" style="text-align: center">Written: <b class="date-string">{date}</b></h3>
        {#if updated}
            <h3 class="blog-date" style="text-align: center">Updated: <b class="date-string">{updated}</b></h3>
        {/if}
    </div>
    <div class="blog-content">{@html marked(postContent)}</div>
    <div class="blog-footer">
        <h2 class="signature"><b style="font-weight: 300">-</b>{author.split(" ")[0]}</h2>
        <applause-button url={postUrl} multiclap="true" color="var(--main-green)"/>
    </div>
</div>

<style>
    .blog-modal {
        color: var(--paragraph-colour);
        text-align: left;
        max-height: 80vh;
        padding: 0 30px 30px 30px;
        overflow-wrap: anywhere;
        overflow-x: hidden;
    }

    .blog-header {
        padding-top: 10px;
        padding-bottom: 10px;
        top: -18px;
        background: var(--modal-background);
        border-bottom: 1.5px dotted var(--paragraph-colour);
        opacity: 0.99;
    }

    .blog-title {
        -webkit-transition: all .2s ease-in;
        -moz-transition: all .2s ease-in;
        -o-transition: all .2s ease-in;
        -ms-transition: all .2s ease-in;
        transition: all .2s ease-in;
        color: rgb(0, 49, 82);
        font-size: 35px;
        margin: 15px 15px 10px 15px;
        color: var(--modal-title-colour);
    }

    .blog-author, .blog-date {
        font-size: 20px;
        margin-top: 8px;
        margin-bottom: 5px;
    }

    .author-name, .date-string {
        font-weight: 300;
    }

    .blog-date {
        font-size: 16px;
        margin: 8px auto 8px auto;
        color: var(--modal-text-colour);
        line-height: 1.4;
    }

    .blog-content {
        line-height: 2.0;
    }

    .blog-footer {
        display: flex;
        justify-content: space-between;
        padding-top: 30px;
    }

    .signature {
        text-shadow: 2px 2px 8px var(--nav-background);
    }

    applause-button {
        width: 65px;
        height: 65px;
        right: 3%;
    }

    @media only screen and (max-width: 620px) {
        .blog-modal {
            font-size: smaller;
        }
        .blog-content {
            line-height: 1.8;
        }
    }
    
    @media only screen and (max-width: 460px) {
        .blog-modal {
            padding: 5px;
            overflow-x: hidden;
        }

        .blog-header {
            position: relative;
        }

        applause-button {
            width: 55px;
            height: 55px;
        }
    }
</style>
