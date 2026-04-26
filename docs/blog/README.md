# Blog Posts

Dev log posts are stored here as Markdown files and published to WordPress via the `blog-session.yml` workflow.

## File naming convention

```
YYYY-MM-DD-slug-of-post.md
```

Example: `2026-04-25-dev-log-1-building-dolmenwood-beyond.md`

## Front matter (required)

Every post must start with YAML front matter:

```yaml
---
title: "Your Post Title"
date: YYYY-MM-DD
author: Your Name
status: draft         # draft | publish
tags: [tag1, tag2]
excerpt: >
  One or two sentence summary shown in the news feed.
---
```

- `status: draft` — publishes to WordPress as a draft (default, safe)
- `status: publish` — publishes immediately as a live post

## Publishing

Run the **Publish Blog Post** workflow from the GitHub Actions tab:

1. Go to Actions → "Publish Blog Post"
2. Click "Run workflow"
3. Select the post file (e.g. `2026-04-25-dev-log-1-building-dolmenwood-beyond.md`)
4. Optionally override the publish status (`draft` or `publish`)
5. Run

The workflow reads the Markdown file, converts it to HTML, and posts it to WordPress via the REST API.

## Writing tips

- Use `##` for top-level sections (the post title is `#`)
- Tables render well in WordPress
- Code blocks with language hints are styled via `.wp-content pre`
- Keep the excerpt field updated — it shows in the in-app news feed
