# brutenis.net

Personal website built with [Astro](https://astro.build), [Tailwind CSS v4](https://tailwindcss.com), and vanilla TypeScript. Features a yarn ball cursor that follows the mouse using Verlet rope physics, and an optional game mode where monsters attack your blog entries.

## Tech Stack

- **Astro v6** - Static site generator
- **Tailwind CSS v4** - Styling
- **Vanilla TypeScript** - All interactivity (no React/Svelte/Vue)
- **Canvas API** - Yarn cursor physics and game rendering
- **GitHub Actions** - CI/CD, deploys via rsync to a Hetzner server

## Getting Started

```sh
npm install
npm run dev      # Start dev server at localhost:4321
npm run build    # Build for production to ./dist/
npm run preview  # Preview the production build locally
```

Requires Node.js >= 22.12.0.

## Content Architecture

The site has four content collections, all defined in `src/content.config.ts`. Each uses a custom Astro loader that fetches content at build time — there are no local content files for projects, games, or CTF writeups.

### Blog

The blog has **two sources**, combined by a single loader (`src/lib/blog-loader.ts`):

#### 1. Local Markdown files

Write a `.md` file in `src/content/blog/`. The filename (without `.md`) becomes the URL slug.

Frontmatter schema:

```yaml
---
title: "My Post Title"
description: "A short description"
pubDate: 2025-01-15
updatedDate: 2025-02-01      # optional
tags: ["astro", "web"]        # optional, defaults to []
heroImage: "/images/hero.png" # optional
draft: false                  # optional, defaults to false (drafts are excluded)
---

Your markdown content here.
```

The post will appear at `/blog/<filename>`.

#### 2. GitHub repository READMEs

Link a GitHub repo in `src/content.config.ts` under the `githubRepos` array. The repo's README is fetched at build time and rendered as a blog post.

```ts
const blog = defineCollection({
  loader: blogLoader({
    contentDir: "./src/content/blog",
    githubRepos: [
      {
        repo: "LiquidFun/godot-tween-cheatsheet", // required: owner/repo
        tags: ["godot", "gamedev"],                // optional
        title: "Custom Title",                     // optional, defaults to repo name
        description: "Custom description",         // optional, defaults to repo description
        pubDate: "2024-06-01",                     // optional, defaults to repo creation date
      },
    ],
  }),
  // ...
});
```

The loader automatically:
- Fetches the README and rewrites relative image/link paths to absolute GitHub URLs
- Pulls the repo description and language from the GitHub API
- Converts bare GitHub video attachment URLs to `<video>` elements
- Sets `source: "github"` and `githubUrl` on the post data

### Projects & Games

Both collections use the same loader (`src/lib/github-loader.ts`) that parses entries from the [LiquidFun GitHub profile README](https://github.com/LiquidFun). Each `<a>` tag with a title and image in the relevant section becomes an entry.

- **Projects** are pulled from the "My Projects" section
- **Games** are pulled from the "My Games" section

To add a new project or game, add an entry to the corresponding section in the [LiquidFun/LiquidFun](https://github.com/LiquidFun/LiquidFun) profile README using this format:

```html
<a href="https://github.com/User/repo" title="Project Name - Description of the project">
  <img src="https://github.com/User/repo/blob/main/thumbnail.png" ...>
</a>
```

The loader will:
- Download the thumbnail to `public/images/projects/` or `public/images/games/`
- Fetch the repo's README as the detail page content
- Pull metadata (language, creation date) from the GitHub API
- Extract links (GitHub, Play Store, etc.) from the href

Pages are rendered at `/projects/<slug>` and `/games/<slug>`.

### CTF Writeups

CTF writeups are loaded from the [LiquidFun/CTF-Writeups](https://github.com/LiquidFun/CTF-Writeups) repository (`src/lib/ctf-loader.ts`). The repo is cloned/pulled at build time into `ctf-writeups/` (cached in CI).

Expected directory structure in the CTF repo:

```
ctf-writeups/
  EventName2024/
    ChallengeName/
      README.md       # writeup content (title extracted from first # heading)
      media/          # optional, images/files referenced in the writeup
  AnotherCTF2023/
    SomeChallenge/
      README.md
```

To add a new writeup:
1. Create a directory under the event name (e.g., `EventName2024/ChallengeName/`)
2. Write a `README.md` with a `# Title` heading and your writeup content
3. Place any images in a `media/` subdirectory and reference them as `./media/image.png`

The loader automatically:
- Parses the year from the event directory name
- Copies media files to `public/ctf-assets/<event>/<challenge>/`
- Rewrites media paths in the markdown accordingly
- Generates tags from the event name

Pages are rendered at `/ctf/<event>/<challenge>`.

### About Page

The about page is a standalone Astro component at `src/pages/about.astro`. Edit it directly — it's plain HTML/Astro markup, not a content collection.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which:

1. Checks out the repo
2. Restores cached CTF writeups
3. Installs dependencies and builds the site
4. Deploys `dist/` via rsync to the Hetzner server

Required GitHub secrets: `HETZNER_HOST`, `HETZNER_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`.

## Project Structure

```
src/
  content.config.ts          # Collection schemas and loader config
  content/blog/              # Local blog markdown files
  lib/
    blog-loader.ts           # Blog loader (local + GitHub)
    github-loader.ts         # Projects/games loader (profile README)
    ctf-loader.ts            # CTF writeups loader (git repo)
  layouts/
    BaseLayout.astro         # Root layout with canvases, nav, view transitions
    BlogPostLayout.astro
    ProjectLayout.astro
  pages/
    index.astro
    about.astro
    blog/
    projects/
    games/
    ctf/
  scripts/
    yarn-cursor/             # Verlet rope physics + yarn ball renderer
    yarn-game/               # WASD game mode with character + collectibles
  components/
ctf-writeups/                # Git submodule (LiquidFun/CTF-Writeups)
public/
  images/                    # Downloaded project/game thumbnails
  ctf-assets/                # Copied CTF media (gitignored, generated at build)
```
