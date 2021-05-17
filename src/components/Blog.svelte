<script>
    import { getContext, onMount } from 'svelte';
    import qs from 'query-string';
    import BlogPostModal from './modals/BlogPostModal.svelte';
    import CloseButton from './modals/CloseButton.svelte';
    import { blogPosts } from '../../public/content/blogPostMeta.js';

    const userQuery = qs.parse(window.location.search);

    blogPosts.sort(function(a, b){
        return b.postId-a.postId
    });

    const { open } = getContext('simple-modal');
    const blogPostModal = (postId, title, author, date, updated, content) => {
        open(BlogPostModal,
        {
            id: postId, title: title, author: author, date: date, updated: updated, content: content
        },
        {
            closeButton: CloseButton,
            styleWindow: {
                width: "950px",
                padding: "5px",
                maxHeight: "92.5%"
            }
        },
        {
            onOpen: () => {
                window.history.replaceState({}, title+" | MaxEisen.me", "/?blog=true&postId="+postId);
                document.title = title+" | MaxEisen.me";
                document.body.style.overflow = "hidden";
            },
            onClose: () => {
                window.history.replaceState({}, "Get to Know Max Eisen | MaxEisen.me", "/");
                document.title = "Get to Know Max Eisen | MaxEisen.me";
                document.body.style.overflowY = "scroll";
            }
        });
    };

    onMount(async () => {
        if (userQuery.blog == 'true') {
            if (userQuery.postId) {
                var blogPost = blogPosts.find(post => {return post.postId==userQuery.postId});
                blogPostModal(blogPost.postId, blogPost.title, blogPost.author, blogPost.date, blogPost.updated, blogPost.content)
            }
        }
    });
</script>

<h1 class="section-title" id="blog" style="text-align: left;">Blog</h1>
<div class="blog-subsection">
    {#each blogPosts as post}
        {#if post.published == true}
            <div class="blog-item" tabindex="0" on:click={() => blogPostModal(post.postId, post.title, post.author, post.date, post.updated, post.content)}>
                <h2 class="blog-name">{post.title}</h2>
                <h2 class="blog-date">{post.date}</h2>
                <h2 class="blog-description">{post.description}</h2>
            </div>
        {/if}
	{/each}
</div>

<style>
    .blog-name {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 30px;
    }

    .blog-date {
        font-size: 23px;
        font-weight: 300;
        margin: 5px auto 5px auto;
        color: var(--item-subtitle);
    }

    .blog-description {
        margin: 8px auto 5px auto;
        text-align: center;
        font-size: 18px;
        color: var(--item-small-text);
        font-weight: 300;
    }
</style>