<script>
    import marked from 'marked';

    export let title;
    export let author;
    export let date;
    export let content;

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
        <h3 class="blog-date" style="text-align: center">{date}</h3>
    </div>
    <div class="blog-content">{@html marked(postContent)}</div>
    <h2 class="signature"><b style="font-weight: 300">-</b>{author.split(" ")[0]}</h2>
</div>

<style>
    .blog-modal {
        color: var(--paragraph-colour);
        text-align: left;
        max-height: 80vh;
        padding: 0 30px 30px 30px;
    }

    .blog-header {
        position: sticky;
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

    .blog-author {
        font-size: 20px;
        margin-top: 8px;
        margin-bottom: 5px;
    }

    .author-name, .blog-date {
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

    .signature {
        padding: 30px 0 30px;
        
    }
    
    @media only screen and (max-width: 460px) {
        .blog-modal {
            padding: 5px;
            overflow-wrap: anywhere;
        }
    }
</style>
