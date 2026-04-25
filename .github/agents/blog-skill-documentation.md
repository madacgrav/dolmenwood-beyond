# Blog Skill — Process Documentation

A reference guide for adding an AI-assisted blog creation capability to any project. This document covers the end-to-end process for capturing work context, generating draft posts, running an editorial review, and publishing to a destination — without any integration into a web application.

---

## Overview

The Blog Skill is a repeatable process that turns completed project work into published blog content. It is designed to be run manually or triggered on a schedule. The process has four stages: **Capture**, **Draft**, **Review**, and **Publish**. Each stage has defined inputs, outputs, and responsible parties.

```
Work Completed → Capture Context → Generate Draft → Editorial Review → Publish
```

---

## Stage 1: Capture

The capture stage gathers all relevant artifacts from a body of completed work into a single context package. This package becomes the sole input to the AI drafting step.

### What to Collect

Collect as many of the following as are available for the work being documented:

- Commit messages and PR descriptions
- Ticket or issue summaries (title, acceptance criteria, resolution notes)
- Changelog or release note entries
- Architecture decision records (ADRs) or design notes
- Meeting notes, retrospective summaries, or sprint reviews
- Screenshots, diagrams, or before/after comparisons
- Metrics, benchmark results, or performance data
- Relevant pull request review comments

### Capture Template

Use this template to package your context before drafting. Save it as `blog-session-{date}.md` in a `/blog-drafts` folder in your project repo or notes tool.

```markdown
## Blog Session Context

**Date:** YYYY-MM-DD  
**Project / Feature:** [Name of the project, feature, or milestone]  
**Work Type:** [Release | Bug Fix | Feature | Architecture | Tutorial | Retrospective]  
**Author:** [Your name or handle]  
**Target Audience:** [Who will read this: developers, end users, leadership, community]  
**Tone:** [Technical | Conversational | Formal | Casual]  
**Target Word Count:** [e.g., 500 | 800 | 1200]  
**Publishing Destination:** [Dev.to | Personal blog | Company blog | LinkedIn | Internal wiki]

---

### Summary of Work Done

[2–5 sentences describing what was built, fixed, or changed. Include the problem it solved.]

### Key Changes or Decisions

- [Change 1]
- [Change 2]
- [Change 3]

### Source Artifacts

[Paste or link commit messages, PR descriptions, ticket text, changelog entries, notes]

### What to Highlight

[Optional: specific wins, interesting approaches, metrics, or lessons the post should emphasize]

### What to Avoid

[Optional: internal-only details, sensitive information, topics out of scope for this post]
```

---

## Stage 2: Draft Generation

With the context package in hand, use an AI assistant to generate the initial draft. This stage produces structured output that feeds directly into the Review stage.

### Generation Prompt

Use the following system and user prompt structure with any capable AI assistant (e.g., GitHub Copilot Chat, Perplexity, ChatGPT, Claude).

**System Prompt:**

```
You are a technical blog writing assistant. Your job is to turn completed project work into a structured, publication-ready blog draft. 

Rules:
- Use only facts from the provided source material. Do not invent details.
- If source material is thin or ambiguous, list clarifying questions before drafting.
- Prefer concrete implementation details and real outcomes over marketing language.
- Write for the specified audience and tone.
- Return structured JSON output matching the schema below.
```

**User Prompt:**

```
Using the context package below, generate a blog post draft.

Return a JSON object with this exact schema:
{
  "titles": ["Option 1", "Option 2", "Option 3"],
  "excerpt": "1–2 sentence summary for preview cards and SEO",
  "seo_description": "Meta description under 160 characters",
  "tags": ["tag1", "tag2", "tag3"],
  "reading_time_minutes": 5,
  "audience": "Who this post is for",
  "outline": [
    { "section": "Introduction", "notes": "What problem we were solving" },
    { "section": "What We Built", "notes": "Key changes and decisions" },
    { "section": "How It Works", "notes": "Technical walkthrough" },
    { "section": "Results", "notes": "Outcomes, metrics, or wins" },
    { "section": "Conclusion", "notes": "Takeaways and next steps" }
  ],
  "body_markdown": "Full draft in Markdown",
  "cta": "Call to action for the end of the post",
  "social_posts": {
    "twitter": "Tweet under 280 characters",
    "linkedin": "LinkedIn post 2–3 sentences"
  },
  "questions": ["Any clarifying questions if source material was insufficient"]
}

--- CONTEXT PACKAGE ---
[Paste your completed capture template here]
```

### Output Storage

Save the raw JSON output alongside your capture template:

```
/blog-drafts/
  blog-session-2026-04-25.md          ← capture template
  blog-session-2026-04-25-draft.json  ← AI output
```

---

## Stage 3: Editorial Review

The review stage transforms the AI-generated draft into a post that is accurate, on-brand, and ready to publish. This is where human judgment is applied.

### Review Checklist

Work through the following in order. Check off each item before moving to publish.

#### Accuracy
- [ ] Every factual claim is supported by the source artifacts
- [ ] No invented metrics, benchmarks, or outcomes
- [ ] Code snippets, commands, or technical steps are correct and tested
- [ ] Version numbers, dates, and names are accurate

#### Structure and Flow
- [ ] Title is specific and clear (avoid generic titles like "Exciting New Update")
- [ ] Introduction hooks the reader and states the problem within the first paragraph
- [ ] Sections follow a logical order with smooth transitions
- [ ] Conclusion includes a clear takeaway and call to action
- [ ] No section exceeds 300 words without a visual break (subheading, list, or code block)

#### Audience and Tone
- [ ] Language matches the specified audience (no unexplained jargon for non-technical readers)
- [ ] Tone is consistent throughout
- [ ] First-person voice is intentional (decide: author I vs. team we vs. third person)
- [ ] No marketing fluff phrases ("game-changing," "revolutionizing," "seamless experience")

#### Completeness
- [ ] Excerpt and SEO description are under 160 characters
- [ ] 3–5 tags are present and accurate
- [ ] Cover image or diagram is attached or noted
- [ ] Social post variants reviewed and ready

#### Legal and Policy
- [ ] No confidential internal details or architecture exposed
- [ ] No client names, data, or PII included without permission
- [ ] Open-source licenses acknowledged if applicable
- [ ] Checked against any company blogging policy

### Revision Prompts

If the draft needs significant changes, use these targeted prompts rather than regenerating from scratch:

| Issue | Revision Prompt |
|-------|----------------|
| Introduction is weak | "Rewrite the introduction to open with the problem, not the solution. One paragraph max." |
| Too technical for audience | "Rewrite [section] for a non-technical reader. Replace jargon with plain language." |
| Thin on detail | "Expand [section] using only the source material provided. Add concrete examples." |
| Too long | "Reduce [section] to the three most important points. Remove any point not actionable." |
| CTA is generic | "Rewrite the CTA to be specific to [audience] and link to [next step]." |
| Title is boring | "Generate 5 alternative titles. Each should be specific, under 70 characters, and convey value." |

---

## Stage 4: Publish

The publish stage moves the approved draft to its destination. The exact steps depend on the platform, but the pre-publish checklist and format rules apply universally.

### Pre-Publish Checklist

- [ ] Draft is in final approved state with all review items resolved
- [ ] Title selected from the three generated options (or a revision of one)
- [ ] Cover image attached (recommended minimum: 1200×630px)
- [ ] Tags confirmed and valid for the platform
- [ ] Author bio and social links current
- [ ] Canonical URL set if cross-posting to multiple platforms
- [ ] Publish date and time confirmed (consider time zones for international audiences)

### Platform Format Notes

| Platform | Format Notes |
|----------|-------------|
| Dev.to | Paste Markdown directly. Use front matter block for title, tags, canonical. |
| Ghost | Use Markdown import or paste into Koenig editor. Set featured image separately. |
| WordPress | Paste body into block editor. Convert Markdown via Jetpack or a plugin. |
| LinkedIn | Plain text only. Strip Markdown formatting. Max 3000 characters. Attach image separately. |
| GitHub Pages / Jekyll | Add front matter (title, date, tags, layout). Save as `YYYY-MM-DD-title.md` in `_posts/`. |
| Astro / Next.js | Add front matter. Save in `src/content/blog/`. Run build to preview. |
| Notion | Paste as Markdown or use Notion's import. Add page icon and cover image. |
| Internal Wiki | Follow your team's template. Link from the relevant project page. |

### Cross-Posting Rules

If publishing to more than one platform, follow these rules to protect SEO and avoid duplicate content penalties:

1. Choose one **canonical source** — the platform where the post lives permanently.
2. On every other platform, set the canonical URL to point to the original source.
3. Wait at least 24 hours before cross-posting to allow the canonical source to be indexed.
4. Use the platform-specific social variant instead of re-posting the full article to LinkedIn or Twitter.

---

## Post Types and Templates

Different work patterns map naturally to different post formats. Use the matching template prompt to get better drafts.

### Release Note Post

Best for: shipped features, version releases, hotfixes.

Add to the user prompt: *"Format this as a release note post. Structure: what's new → why it matters → how to use it → breaking changes if any → upgrade steps."*

### Technical Deep Dive

Best for: architecture decisions, implementation walkthroughs, performance work.

Add to the user prompt: *"Format this as a technical deep dive. Structure: the problem → constraints → what we tried → what we chose → implementation details → results → what we'd change."*

### Build Journal / Progress Update

Best for: ongoing project updates, sprint recaps, milestone check-ins.

Add to the user prompt: *"Format this as a build journal entry. Structure: what we set out to do → what we accomplished → blockers we hit → how we resolved them → what's next."*

### Retrospective

Best for: project wrap-ups, end-of-quarter reflections, post-mortems.

Add to the user prompt: *"Format this as a team retrospective post. Structure: project background → what went well → what didn't → key decisions in hindsight → what we'd do differently → lessons for the team."*

### Tutorial / How-To

Best for: repeatable processes, tooling setup, code walkthroughs.

Add to the user prompt: *"Format this as a step-by-step tutorial. Structure: what you'll build → prerequisites → step 1 through N with code → common errors and fixes → what you can build next."*

---

## File and Folder Conventions

Use a consistent structure in your project repo or notes tool to keep all blog sessions organized and recoverable.

```
/blog-drafts/
├── README.md                              ← links to this process doc
├── 2026-04-25-feature-x/
│   ├── capture.md                         ← Stage 1 context package
│   ├── draft.json                         ← Stage 2 AI output
│   ├── draft-v1.md                        ← Stage 3 reviewed Markdown
│   ├── draft-v2.md                        ← Stage 3 revision if needed
│   ├── cover-image.png                    ← Stage 4 asset
│   └── publish-log.md                     ← Stage 4 publish record
└── templates/
    ├── capture-template.md
    └── prompt-templates.md
```

### Publish Log Template

After publishing, save a brief record so you can track what was posted, where, and when.

```markdown
## Publish Log

**Post Title:** [Final title]  
**Published Date:** YYYY-MM-DD  
**Author:** [Name]

| Platform | URL | Canonical | Status | Date Published |
|----------|-----|-----------|--------|----------------|
| Dev.to   | https://dev.to/... | Yes | Published | 2026-04-25 |
| LinkedIn | https://linkedin.com/... | No (canonical: Dev.to) | Published | 2026-04-26 |

**Notes:** [Any context about this post worth remembering]
```

---

## Quick Reference

### End-to-End Checklist

| Stage | Key Action | Output |
|-------|-----------|--------|
| Capture | Fill out capture template with all work artifacts | `capture.md` |
| Draft | Run generation prompt against capture template | `draft.json` |
| Review | Work through review checklist, revise as needed | `draft-v1.md` |
| Publish | Run pre-publish checklist, post to platform | Publish log entry |

### Common Mistakes to Avoid

- Skipping the capture template and pasting raw commit messages directly into the prompt — this produces vague drafts
- Publishing the AI draft without an accuracy review — invented details are common
- Using the same post on multiple platforms without setting a canonical URL
- Letting the AI use marketing language without reviewing for it — search for "seamless," "powerful," "revolutionize," and delete on sight
- Not saving the capture template — you will need it when someone asks where a claim came from

---

*Last updated: April 2026*
