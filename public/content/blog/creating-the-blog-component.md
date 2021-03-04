# Foreword
This week, I decided to add some functionality to my site to make it more... interesting.

I started with an implementation of a theme switcher (click the memoji icon at the top left to try it out), and some UI/UX improvements to make it easier to navigate and cleaner to look at.

Why did I make these changes? Well, I wanted to shape my site up a bit with the intention of adding a blog component (this one!) so that there's actually a reason to visit my site aside from seeing career things. It also gives the site a reason to be a [PWA](https://web.dev/progressive-web-apps/), while previously, if you installed my site, all you'd really get would be static info about me and my career.

So, with that out of the way, let's talk about how I developed this component today.

# Thought Process

## Developing a "Routing" System (Not Really Though)
I had wanted to start blogging for a while, but in a more private and custom environment than, say, Medium or DEV. I had been inspired by many others' dev portfolios to try to host my blog on my own site. With that said, I liked the simplicity of my website's stack and architecture, and didn't want to change that too much.

So, trying to stick with the use of modals to display the lengthier details of things on my site (specifically, the [svelte-simple-modal package](https://www.npmjs.com/package/svelte-simple-modal)), I decided that I'd try to think through a way to display blog posts written in Markdown in a similar way, using these modals.

Then it occurred to me that without proper routing, these blog posts wouldn't really be "shareable", and what's a blog post if it can't be shared with a direct link?

I then thought of ways I could implement a sort of ID and routing system that would allow for each blog post to have its own, unique URL, while still keeping the site's tech stack simple. Most of this thought kept me up in bed last night with that feeling of really wanting to get up and just **code it**, but knowing that it was late and I probably shouldn't.

So instead, I broke the technical challenges down into two parts - the "creation" of these direct URLs, and the parsing of these same URLs.

### "Creating" URLs
It occurred to me that if I wanted to make these blog posts "shareable", then they would definitely need unique URLs. Without routing, I knew this would be a hacky solution, but maybe I could make it kind of *clean* hacky. I didn't really do too much pre-planning for this part because I didn't know what would be possible and how I would create these routes without actually creating them. It would come down to some research.

We'll get back to this...

### Parsing URLs
Going off the assumption that these URLs *would* exist at some point, I skipped ahead and started thinking of ways to have these specific URLs call up modals with specific blog posts.

I knew I could programmatically load up a modal containing pretty much whatever I wanted, but didn't know how I could make a specific URL do this, especially without actually *routing* to a different page.

So I thought maybe I could use URL query parameters paired with some simple code to figure out which blog post to load up.

Simple enough!

# Implementation

## Style
The style wasn't going to be too crazy or difficult to implement. I thought of how I'd want blog post "items" to look on my site's main page, and I figured with my jobs and projects being in rows of either two or three items (on a full-sized desktop), these blog post previews would look good as full width items - one per line.

I could reuse a lot of the CSS I used to style the other items on my site for this, just changing the grids to have one column instead of two or three.

Colours and whatnot would stay the same as the rest of the site, changing based on the recently implemented theme toggle feature.

I ended up implementing a header inside the blog post modals that would stick at the top of the modal until a certain point. This would keep the reader aware of what they're reading about until they're a good chunk into it.

## Formatting
I knew I wanted to use a Markdown pre-processor to convert the blog posts to HTML that could be displayed nicely, matching the global style of my site.

Using [Marked](https://marked.js.org/), this was pretty simple. I'd load the blog post "meta data" into the modal component, where it would then fetch the Markdown blog post file (like this one), converting it to text, then HTML using Marked, and then using Svelte's `@html` tag to display the converted Markdown as HTML, taking on my defined styles. After some messing around, I got this to work nicely.

Sweet!

## "Creating" URLs
Now came the challenge of actually making the "routes" for these blog posts.

After researching for a while, it occurred to me that I *could* just change the extended part of the URL (after the '/'), as well as the title of the page (more for the look of it) at the instantiation of the blog post modal.

This way, when a user clicked on a blog post, it would seem like there was some server-side rendering going on that just magically changed the URL and document title to match what the screen showed.

In reality, there was no routing going on. It was simply changing the displayed address and title using the History API's `replaceState` method and changing the document's title property, like so:

```javascript
window.history.replaceState({}, "", "/?blog=true&postId=" + {blog post ID});
document.title = {blog post title} + " | MaxEisen.me";
```

Similarly, when the visitor *closed* the blog post modal, I would revert the URL ending and page title back to the default, using the same method.

In order to run these commands when a modal was opened and closed, I used the svelte-simple-modal `onOpen` and `onClose` callbacks.

This seemed to work!

## Parsing URLs
Since I now had unique URLs for my blog posts, I decided to use the [query-string package](https://www.npmjs.com/package/query-string) to help open the correct blog post modal when a user visited a certain post's URL. This package would allow me to check the URL's query parameters to select which blog post to open. Using `queryString.parse(window.location.search)`, I could break down the queries in the URL like so (using the current post as an example):

```javascript
{
    blog: "true",
    postId: "0"
}
```

This allowed me to check if a visiting user was coming to see a specific blog post. The `blog` parameter would tell me if the visitor was following a blog link, and the `postId` parameter would tell me which blog post the visitor wanted to see.

From there, I was able to write some simple JavaScript in an `onMount` handler to create the correct blog post modal containing the blog post (identified by `postId`, sourced from a separate file on instantiation).

That was it!

# Challenges and Downsides
This project was certainly challenging in many ways. From finding a way to make these blog posts "shareable"-ish, to the classic challenges that any frontend developer faces while trying to style things (like centering a `div` 😠).

Despite the effort I put into this, my implementation of a blog is... not ideal. 

For one, there is no real routing going on, and all content is served statically. On the bright side, I was able to use `fetch` to actually only get the Markdown for the blog posts when a user clicks on one. This will cut down on load time of the website.

Another downside is that these blog posts are not really "shareable" in the end anyways. Yes, a link can be shared that will take a visitor to a specific blog post, but the title associated with that link will not match the title of the blog post. This is because the document title is only changed on load of the modal. This means any time I, or someone else, shares a blog post on social media or elsewhere, the title of the link preview will still just be my website's default title.

Sad!

# Summary
All of that aside, this was a fun and cool project, and it allowed me to take a break from other coding projects that I have for school to do something I genuinely enjoyed problem solving for.

The hacky implementation is what it is.

My favourite thing about coding has always been, and still is problem solving, and there was plenty of that in this project, so I'd say it's a win overall! Plus it even gave me a chance to refactor some of the other code on this site, including putting the data for my projects, experience, and education into separate files in the `content` directory. Implementing changes like these give me more confidence in my code organization skills.

Down the road, I'm sure I'll be giving my site a complete overhaul anyway, using some cool new frontend framework, server-side rendering, proper routing, and more!

For now, this'll do ✌