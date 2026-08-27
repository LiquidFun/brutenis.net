import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

/**
 * The feed carries blog posts, projects and games in one reverse-chronological
 * list. Each item is tagged with a category naming its kind, so a reader can
 * tell a released game from a written post.
 *
 * CTF writeups are absent on purpose: the collection is parsed from a directory
 * tree and only carries an event year, not a publication date, so the items
 * would have nothing meaningful to sort or timestamp by.
 */
export async function GET(context: APIContext) {
  const [posts, projects, games] = await Promise.all([
    getCollection("blog", ({ data }) => !data.draft),
    getCollection("projects"),
    getCollection("games"),
  ]);

  const items = [
    ...posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      categories: ["Blog", ...post.data.tags],
    })),
    ...projects.map((project) => ({
      title: project.data.title,
      pubDate: project.data.date,
      description: project.data.description,
      link: `/projects/${project.id}/`,
      categories: ["Project", ...project.data.tags],
    })),
    ...games.map((game) => ({
      title: game.data.title,
      pubDate: game.data.date,
      description: game.data.description,
      link: `/games/${game.id}/`,
      categories: ["Game", ...game.data.tags],
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: "brutenis.net",
    description: "A yarn-tangled corner of the internet",
    site: context.site!,
    items,
  });
}
