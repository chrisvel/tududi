# Blog

The blog is made of public notes. One note is the front page; the public notes it links with `[[Title]]` are the posts. It is meant for tududi.com's own writing, and every page leads to tududi Cloud.

## Publishing

1. Write a front page note. Its text is the intro. A paragraph that is only `[[Post title]]` links becomes post cards, in that order.
2. Write the posts as ordinary notes. A post can link further notes with `[[...]]`; those become posts too.
3. Share the front page and every post publicly (the globe on the note). Sharing is the publish switch: an unshared note drops off the blog on the next load.
4. As the superadmin, open **Admin → Blog** and paste the front page note's link or uid. Only your own notes are accepted. **Turn off** takes the blog down.

A public note that the blog does not link never appears on it, and neither does a private note or another user's note, even when a post links it.

## What readers see

- Posts render with the same article component as a note's public link (`frontend/components/PublicNote/PublicNoteArticle.tsx`), with the blog navbar, a Cloud offer and more posts around it.
- A post's address is its slugified title (`/how-to-organize-a-family-with-tududi`); a repeated title gets `-2`. Renaming a note changes its address.
- Cards show the share date, the first image as a cover and the first plain paragraph as the summary.

## Where it is served

- In the app at `/blog`, signed in or out.
- At the root of every hostname in `TUDUDI_BLOG_HOSTS`. There the server returns the app shell marked with `<meta name="tududi-site" content="blog">`, adds the page title, description and Open Graph tags for the post, and serves `/sitemap.xml`, `/rss.xml` and `/robots.txt`. `frontend/index.tsx` renders the blog instead of the app and skips the service worker.
- The landing page links the blog from its nav and footer when `TUDUDI_BLOG_URL` (or the first `TUDUDI_BLOG_HOSTS` entry) gives it an address.

| Variable | Purpose |
|----------|---------|
| `TUDUDI_BLOG_HOSTS` | Hostnames that serve the blog at their root, e.g. `blog.tududi.com` |
| `TUDUDI_BLOG_URL` | The blog's public address for links; defaults to `https://<first blog host>` |

The webpack dev server never sends the blog marker, so check blog-host behaviour against the backend: build the frontend, copy `dist/` to `backend/dist/`, start the backend with `TUDUDI_BLOG_HOSTS=blog.localhost` and open `http://blog.localhost:3002`.

## Code

- `backend/modules/blog/service.js`: the front page setting (`settings.blog_note_uid`), the walk over `[[links]]`, slugs and the index/post payloads.
- `backend/modules/blog/routes.js`: `GET /api/public/blog` and `GET /api/public/blog/posts/:slug`, before authentication, cacheable for five minutes.
- `backend/modules/blog/hostSwitch.js`: the blog hostnames.
- `GET` / `PUT /api/admin/blog` in the admin module, superadmin only.
- `frontend/components/Blog/`: the pages; `frontend/components/Admin/AdminBlogSettings.tsx`: the admin popup.
