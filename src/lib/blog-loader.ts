import type { Loader } from "astro/loaders";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { fetchReadme, fetchRepoMeta, slugify } from "./github-loader";

interface GithubBlogEntry {
  repo: string;
  title?: string;
  description?: string;
  tags?: string[];
  pubDate?: string;
}

export function blogLoader(options: {
  contentDir: string;
  githubRepos?: GithubBlogEntry[];
}): Loader {
  return {
    name: "blog-loader",
    async load({ store, logger, parseData, renderMarkdown }) {
      // Part 1: Load local .md files
      const contentDir = options.contentDir;
      if (existsSync(contentDir)) {
        const files = readdirSync(contentDir).filter((f) => f.endsWith(".md"));
        for (const file of files) {
          const filePath = join(contentDir, file);
          const raw = readFileSync(filePath, "utf-8");
          const { frontmatter, content } = parseFrontmatter(raw);

          if (frontmatter.draft) continue;

          const id = basename(file, ".md");
          const rendered = await renderMarkdown(content);

          const data = await parseData({
            id,
            data: {
              ...frontmatter,
              source: "local",
            },
          });

          store.set({ id, data, body: content, rendered });
        }
      }

      // Part 2: Load GitHub README entries
      for (const entry of options.githubRepos || []) {
        const repoName = entry.repo.split("/")[1];
        const id = slugify(entry.title || repoName);

        const [readmeContent, repoMeta] = await Promise.all([
          fetchReadme(entry.repo, logger),
          fetchRepoMeta(entry.repo),
        ]);

        const title =
          entry.title ||
          repoName
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        const description =
          entry.description || repoMeta.description || title;
        const pubDate = entry.pubDate || repoMeta.createdAt;

        const tags: string[] = [...(entry.tags || [])];
        if (repoMeta.language && !tags.includes(repoMeta.language)) {
          tags.push(repoMeta.language);
        }

        const data = await parseData({
          id,
          data: {
            title,
            description,
            pubDate,
            tags,
            source: "github",
            githubUrl: `https://github.com/${entry.repo}`,
            draft: false,
          },
        });

        store.set({
          id,
          data,
          body: readmeContent.body || description,
          rendered: {
            html: readmeContent.html || `<p>${description}</p>`,
          },
        });
      }
    },
  };
}
