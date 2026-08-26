import { defineCollection, z } from "astro:content";
import { ctfLoader } from "./lib/ctf-loader";
import { githubProfileLoader } from "./lib/github-loader";
import { blogLoader } from "./lib/blog-loader";
import { immichLoader } from "./lib/immich-loader";
import { photoAlbums } from "./data/photo-albums";

const blog = defineCollection({
  loader: blogLoader({
    contentDir: "./src/content/blog",
    githubRepos: [
      {
        repo: "LiquidFun/godot-tween-cheatsheet",
        tags: ["godot", "gamedev"],
      },
    ],
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
    source: z.enum(["local", "github"]).default("local"),
    githubUrl: z.string().optional(),
    stars: z.number().optional(),
  }),
});

const linksSchema = z
  .object({
    github: z.string().optional(),
    live: z.string().optional(),
    docs: z.string().optional(),
    "play store": z.string().optional(),
    play: z.string().optional(),
    itch: z.string().optional(),
  })
  .default({});

const mediaSchema = z
  .array(
    z.object({
      type: z.enum(["image", "video"]),
      src: z.string(),
      alt: z.string().optional(),
    }),
  )
  .default([]);

const projectGameSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  thumbnail: z.string().optional(),
  stars: z.number().optional(),
  links: linksSchema,
  media: mediaSchema,
  featured: z.boolean().default(false),
});

const projects = defineCollection({
  loader: githubProfileLoader({
    section: "My Projects",
    imageDir: "images/projects",
  }),
  schema: projectGameSchema,
});

const games = defineCollection({
  loader: githubProfileLoader({
    section: "My Games",
    imageDir: "images/games",
  }),
  schema: projectGameSchema,
});

const ctf = defineCollection({
  loader: ctfLoader({ base: "./ctf-writeups", repo: "https://github.com/LiquidFun/CTF-Writeups.git" }),
  schema: z.object({
    title: z.string(),
    event: z.string(),
    eventYear: z.number().optional(),
    tags: z.array(z.string()).default([]),
    description: z.string().default(""),
  }),
});

const renditionSchema = z.object({
  width: z.number(),
  height: z.number(),
  url: z.string(),
});

const photos = defineCollection({
  loader: immichLoader({ albums: photoAlbums }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string().default(""),
    /** Position in src/data/photo-albums.ts, which is the page order. */
    order: z.number(),
    photos: z.array(
      z.object({
        id: z.string(),
        width: z.number(),
        height: z.number(),
        src: z.string(),
        renditions: z.array(renditionSchema).nonempty(),
        full: renditionSchema,
        alt: z.string(),
      }),
    ),
  }),
});

export const collections = { blog, projects, games, ctf, photos };
