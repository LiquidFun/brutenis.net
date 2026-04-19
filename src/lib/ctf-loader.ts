import type { Loader } from "astro/loaders";
import { readFileSync, existsSync, readdirSync, cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { marked } from "marked";

interface CtfLoaderOptions {
  base: string;
  repo: string;
}

function ensureRepo(repoUrl: string, targetDir: string, logger: { info: (msg: string) => void; warn: (msg: string) => void }) {
  try {
    if (!existsSync(targetDir)) {
      logger.info(`Cloning ${repoUrl} into ${targetDir}...`);
      execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`, {
        stdio: "pipe",
        timeout: 60_000,
      });
    } else if (existsSync(join(targetDir, ".git"))) {
      logger.info(`Updating ${targetDir}...`);
      execSync(`git -C ${targetDir} pull --ff-only`, {
        stdio: "pipe",
        timeout: 30_000,
      });
    }
  } catch (e) {
    logger.warn(`Failed to clone/update CTF repo: ${e}`);
  }
}

export function ctfLoader(options: CtfLoaderOptions): Loader {
  return {
    name: "ctf-writeups-loader",
    async load({ store, logger, parseData }) {
      const base = options.base;

      ensureRepo(options.repo, base, logger);

      if (!existsSync(base)) {
        logger.warn(`CTF writeups directory not found: ${base}`);
        return;
      }

      const events = readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."));

      for (const eventDir of events) {
        const eventPath = join(base, eventDir.name);
        const challenges = readdirSync(eventPath, { withFileTypes: true })
          .filter((d) => d.isDirectory());

        for (const challengeDir of challenges) {
          const readmePath = join(eventPath, challengeDir.name, "README.md");
          if (!existsSync(readmePath)) continue;

          const rawContent = readFileSync(readmePath, "utf-8");

          // Extract title from first # heading or directory name
          const titleMatch = rawContent.match(/^#\s+(.+)/m);
          let title = titleMatch
            ? titleMatch[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()
            : challengeDir.name;

          const eventName = eventDir.name;
          const slug = `${eventName.toLowerCase()}/${challengeDir.name.toLowerCase()}`;

          // Parse year from event name
          const yearMatch = eventName.match(/(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1]) : undefined;

          // Copy media files to public directory
          const mediaDir = join(eventPath, challengeDir.name, "media");
          const publicMediaDir = join("public", "ctf-assets", eventName, challengeDir.name);
          if (existsSync(mediaDir)) {
            mkdirSync(publicMediaDir, { recursive: true });
            cpSync(mediaDir, publicMediaDir, { recursive: true });
          }

          // Process content
          let body = rawContent;
          // Remove the first heading (we use title from metadata)
          body = body.replace(/^#\s+.+\n*/m, "");
          // Rewrite media paths: ./media/foo.png or media/foo.png -> /ctf-assets/Event/Challenge/foo.png
          body = body.replace(
            /(?:\.\/)?media\//g,
            `/ctf-assets/${eventName}/${challengeDir.name}/`,
          );

          // Render markdown to HTML
          const html = await marked.parse(body);

          const data = await parseData({
            id: slug,
            data: {
              title,
              event: eventName,
              eventYear: year,
              tags: ["ctf", eventName.toLowerCase()],
              description: `Writeup for ${title} from ${eventName}`,
            },
          });

          store.set({
            id: slug,
            data,
            body,
            rendered: {
              html,
            },
          });
        }
      }
    },
  };
}
