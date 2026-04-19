import type { Loader } from "astro/loaders";
import { marked } from "marked";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const PROFILE_README_URL =
  "https://raw.githubusercontent.com/LiquidFun/LiquidFun/master/README.md";

interface ParsedEntry {
  href: string;
  title: string;
  description: string;
  imgUrl: string;
  repo: string | null; // owner/repo extracted from github href, null for non-github links
}

/** Parse the profile README HTML to extract project/game entries between two h2 headings */
function parseSection(readmeHtml: string, sectionTitle: string): ParsedEntry[] {
  // Find section start
  const sectionRegex = new RegExp(
    `<h2[^>]*>${sectionTitle}</h2>([\\s\\S]*?)(?=<h2|$)`,
  );
  const sectionMatch = readmeHtml.match(sectionRegex);
  if (!sectionMatch) return [];

  const sectionHtml = sectionMatch[1];

  // Extract all <a> tags with title and img
  const entryRegex =
    /<a\s+href="([^"]+)"\s+title="([^"]+)"[^>]*>\s*<img\s+src="([^"]+)"[^>]*>\s*<\/a>/gi;
  const entries: ParsedEntry[] = [];
  let match;

  while ((match = entryRegex.exec(sectionHtml)) !== null) {
    const href = match[1];
    const titleAttr = match[2];
    const imgUrl = match[3];

    // Parse title: "Name - description | team info" or "Name - description"
    const titleParts = titleAttr.split(" - ");
    const name = titleParts[0].trim();
    const rest = titleParts.slice(1).join(" - ").trim();

    // Extract repo from github URL
    const repoMatch = href.match(
      /github\.com\/([^/]+\/[^/]+)/,
    );
    const repo = repoMatch ? repoMatch[1].replace(/\/$/, "") : null;

    entries.push({
      href,
      title: name,
      description: rest || name,
      imgUrl,
      repo,
    });
  }

  return entries;
}

/** Convert github blob URL to raw content URL */
function blobToRaw(url: string): string {
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}

/** Slugify a title into a URL-safe id */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Fetch a repo's README, process it, and return body + html */
export async function fetchReadme(
  repo: string,
  logger: { warn: (msg: string) => void },
): Promise<{ body: string; html: string }> {
  const fallback = { body: "", html: "" };
  try {
    const url = `https://raw.githubusercontent.com/${repo}/HEAD/README.md`;
    const resp = await fetch(url);
    if (!resp.ok) {
      logger.warn(`README fetch failed for ${repo}: ${resp.status}`);
      return fallback;
    }

    let body = await resp.text();

    // Remove title heading (markdown # or HTML <h1>)
    body = body.replace(/^#\s+.+\n*/m, "");
    body = body.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/gi, "");

    // Rewrite relative image markdown to absolute GitHub URLs
    body = body.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
      (_, alt, path) => {
        const clean = path.replace(/^\.\//, "");
        return `![${alt}](https://raw.githubusercontent.com/${repo}/HEAD/${clean})`;
      },
    );

    // Rewrite HTML img src
    body = body.replace(/src="(?!https?:\/\/)([^"]+)"/g, (_, path) => {
      const clean = path.replace(/^\.\//, "");
      return `src="https://raw.githubusercontent.com/${repo}/HEAD/${clean}"`;
    });

    // Rewrite relative markdown links
    body = body.replace(
      /\[([^\]]*)\]\((?!https?:\/\/|#)([^)]+)\)/g,
      (_, text, path) => {
        const clean = path.replace(/^\.\//, "");
        return `[${text}](https://github.com/${repo}/blob/HEAD/${clean})`;
      },
    );

    // Convert bare GitHub user-attachments URLs to inline video elements
    body = body.replace(
      /^(https:\/\/github\.com\/user-attachments\/assets\/[^\s]+)$/gm,
      (_, url) =>
        `<video src="${url}" controls autoplay loop muted playsinline></video>`,
    );

    const html = await marked.parse(body);
    return { body, html };
  } catch (e) {
    logger.warn(`Error fetching README for ${repo}: ${e}`);
    return fallback;
  }
}

/** Download an image to public/ and return the local path */
async function downloadImage(
  imgUrl: string,
  dir: string,
  logger: { warn: (msg: string) => void },
): Promise<string | undefined> {
  try {
    const rawUrl = blobToRaw(imgUrl);
    const filename = decodeURIComponent(basename(new URL(rawUrl).pathname));
    const localPath = join(dir, filename);
    // Strip "public/" prefix for the web-serving path
    const publicPath = "/" + dir.replace(/^public\//, "") + "/" + filename;

    if (existsSync(localPath)) return publicPath;

    const resp = await fetch(rawUrl);
    if (!resp.ok) {
      logger.warn(`Image download failed: ${rawUrl} (${resp.status})`);
      return undefined;
    }

    mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(await resp.arrayBuffer());
    writeFileSync(localPath, buffer);
    return publicPath;
  } catch (e) {
    logger.warn(`Image download error: ${e}`);
    return undefined;
  }
}

/** Fetch repo metadata (description, language, created_at) from GitHub API */
export async function fetchRepoMeta(repo: string): Promise<{
  description: string;
  language: string;
  createdAt: string;
}> {
  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}`);
    if (!resp.ok) return { description: "", language: "", createdAt: "2020-01-01" };
    const data = await resp.json();
    return {
      description: data.description || "",
      language: (data.language || "").toLowerCase(),
      createdAt: data.created_at || "2020-01-01",
    };
  } catch {
    return { description: "", language: "", createdAt: "2020-01-01" };
  }
}

export function githubProfileLoader(options: {
  section: string;
  imageDir: string;
}): Loader {
  return {
    name: `github-profile-loader-${options.section}`,
    async load({ store, logger, parseData }) {
      // 1. Fetch profile README
      let readmeText: string;
      try {
        const resp = await fetch(PROFILE_README_URL);
        if (!resp.ok) {
          logger.warn(`Failed to fetch profile README: ${resp.status}`);
          return;
        }
        readmeText = await resp.text();
      } catch (e) {
        logger.warn(`Error fetching profile README: ${e}`);
        return;
      }

      // 2. Parse the requested section
      const entries = parseSection(readmeText, options.section);
      if (entries.length === 0) {
        logger.warn(`No entries found in section "${options.section}"`);
        return;
      }

      logger.info(`Found ${entries.length} entries in "${options.section}"`);

      // 3. Process each entry
      for (const entry of entries) {
        const id = slugify(entry.title);

        // Download thumbnail
        const thumbnail = await downloadImage(
          entry.imgUrl,
          `public/${options.imageDir}`,
          logger,
        );

        // Fetch repo README if it's a github link
        let readmeContent = { body: "", html: "" };
        let repoMeta = { description: "", language: "", createdAt: "2020-01-01" };

        if (entry.repo) {
          [readmeContent, repoMeta] = await Promise.all([
            fetchReadme(entry.repo, logger),
            fetchRepoMeta(entry.repo),
          ]);
        }

        // Use profile title description, fall back to repo description
        const description = entry.description || repoMeta.description || entry.title;

        // Build tags from language + parsed description hints
        const tags: string[] = [];
        if (repoMeta.language) tags.push(repoMeta.language);
        if (entry.description.toLowerCase().includes("game-jam") ||
            entry.description.toLowerCase().includes("game jam")) {
          tags.push("gamejam");
        }

        // Build links
        const links: Record<string, string> = {};
        if (entry.repo) {
          links.github = `https://github.com/${entry.repo}`;
        }
        if (entry.href && !entry.href.includes("github.com")) {
          // Non-github link (e.g. Play Store)
          if (entry.href.includes("play.google.com")) {
            links["play store"] = entry.href;
          } else {
            links.live = entry.href;
          }
        }

        const fallbackHtml = description
          ? `<p>${description}</p>`
          : "";

        const data = await parseData({
          id,
          data: {
            title: entry.title,
            description,
            date: repoMeta.createdAt,
            tags,
            thumbnail,
            links,
            media: [],
            featured: false,
          },
        });

        store.set({
          id,
          data,
          body: readmeContent.body || description,
          rendered: { html: readmeContent.html || fallbackHtml },
        });
      }
    },
  };
}
