#!/usr/bin/env python3
"""Start a new blog post: make its .md file with the front matter filled in.

The file goes in public/content/blog/<slug>.md, where the slug is the title
in lowercase with dashes ("My First Post" -> my-first-post). The front
matter at the top holds the post's details (see
src/components/Blog/lib/frontMatter.js for every field):

    title        the title, in title case
    date         today's date
    description  one or two lines for the /blog list and link previews
    draft        true leaves the post off the /blog list (it still opens at
                 /blog/<slug>); false lists it. Defaults to false.
    tags         comma-separated, lowercase words with dashes ("design, web-dev");
                 /blog?tag=design lists the posts with that tag. Can be empty.

It also writes the optional `cover`, `updated` and `note` fields, commented
out with `#`, so they're there to fill in if the post needs them. A cover is
shown at the top of the post and in link previews; 1200 x 630 fits previews
best. Put it at the path the `cover` line suggests.

Run:
    python3 scripts/bootstrap_blog_post.py "my new post"
    npm run blog:new -- "my new post"      (the same as the line above, from npm)
    python3 scripts/bootstrap_blog_post.py "my new post" --draft
    python3 scripts/bootstrap_blog_post.py "my new post" --draft --tags "design, web dev" --description "What it's about."

It won't overwrite a post that already exists.
"""

from __future__ import annotations

import argparse
import datetime
import re
import sys
import unicodedata
from pathlib import Path

BLOG_DIR = Path(__file__).resolve().parent.parent / "public" / "content" / "blog"

# Short words that stay lowercase in a title unless they're the first or last
# word, as in "My Sense of Design" (the usual title-case rule).
SMALL_WORDS = {
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
    "nor", "of", "off", "on", "onto", "or", "over", "per", "so", "the", "to",
    "up", "via", "vs", "with", "yet",
}

DESCRIPTION_PLACEHOLDER = "TODO: one or two lines for the post list and link previews."


def _cap(word: str) -> str:
    """Capitalize the first letter, leaving the rest as typed."""
    for i, ch in enumerate(word):
        if ch.isalpha():
            return word[:i] + ch.upper() + word[i + 1:]
    return word


def title_case(text: str) -> str:
    """Put a title in title case: 'my sense of design' -> 'My Sense of Design'.

    Words that already have a capital after their first letter (iPod, API,
    JavaScript) are kept exactly as typed. Each part of a hyphenated word is
    capitalized ("Self-Hosted"). A small word after a colon is capitalized,
    because it starts a subtitle.
    """
    words = text.split()
    out = []
    for i, word in enumerate(words):
        first = i == 0 or words[i - 1].endswith(":")
        last = i == len(words) - 1
        if any(ch.isupper() for ch in word[1:]):
            out.append(word)
        elif word.lower().strip(".,:;!?'\"()") in SMALL_WORDS and not first and not last:
            out.append(word.lower())
        else:
            out.append("-".join(_cap(part.lower()) for part in word.split("-")))
    return " ".join(out)


def slugify(title: str) -> str:
    """Turn a title into a file name: 'Don't Panic: Café Notes' -> 'dont-panic-cafe-notes'.

    Only lowercase letters, numbers and dashes, which is what the site
    accepts as a post's file name.
    """
    ascii_text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    ascii_text = re.sub(r"['’]", "", ascii_text.lower())
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")


def parse_tags(text: str | None) -> list[str]:
    """Split and clean tags: 'Design, Web Dev, design' -> ['design', 'web-dev'].

    The same shape the site checks for: lowercase letters, numbers and
    dashes, no repeats, in the order given.
    """
    tags: list[str] = []
    for part in (text or "").split(","):
        tag = slugify(part)
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def front_matter(title: str, slug: str, date: str, description: str, draft: bool, tags: list[str]) -> str:
    """Build the start of a new post: its front matter and a first heading."""
    return "\n".join([
        "---",
        f"title: {title}",
        f"date: {date}",
        f"description: {description}",
        f"draft: {'true' if draft else 'false'}",
        f"tags: {', '.join(tags)}".rstrip(),
        f"# cover: /img/blog/{slug}/cover.jpg",
        f"# updated: {date}",
        "# note: An aside shown above the text, e.g. what's changed since it was written.",
        "---",
        "## Foreword",
        "",
        "",
    ])


def main(argv: list[str] | None = None) -> int:
    """Read the command line, write the new post, and return the exit code."""
    parser = argparse.ArgumentParser(description="Make a new blog post file with its front matter filled in.")
    parser.add_argument("title", help='the post title, in quotes, e.g. "my new post"')
    parser.add_argument("--draft", action="store_true", help="keep the post off the /blog list (default: listed)")
    parser.add_argument("--description", help="one or two lines for the post list (default: a TODO placeholder)")
    parser.add_argument("--tags", help='comma-separated tags, e.g. "design, web dev" (default: none)')
    args = parser.parse_args(argv)

    raw = " ".join(args.title.split())
    if not raw:
        parser.error("the title can't be empty")
    title = title_case(raw)
    slug = slugify(title)
    if not slug:
        parser.error("the title needs at least one letter or number for the file name")

    description = " ".join((args.description or "").split()) or DESCRIPTION_PLACEHOLDER
    path = BLOG_DIR / f"{slug}.md"
    if path.exists():
        print(f"{path} already exists. Pick another title or edit that file.", file=sys.stderr)
        return 1

    today = datetime.date.today().isoformat()
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    tags = parse_tags(args.tags)
    path.write_text(front_matter(title, slug, today, description, args.draft, tags), encoding="utf-8")

    print(f"Created {path}")
    print(f"  title: {title}")
    print(f"  date:  {today}")
    print(f"  draft: {'true (not on the /blog list)' if args.draft else 'false (listed on /blog)'}")
    print(f"  tags:  {', '.join(tags) or '(none)'}")
    print(f"  url:   /blog/{slug}")
    print(f"  cover: put an image at public/img/blog/{slug}/cover.jpg and uncomment the cover line")
    if description == DESCRIPTION_PLACEHOLDER:
        print("Remember to replace the TODO description before you publish.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
