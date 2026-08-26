import type { Loader } from "astro/loaders";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { PhotoAlbumSource } from "../data/photo-albums";

/**
 * Build-time mirror of public Immich albums.
 *
 * Photos are never committed. For every asset in a shared album this downloads
 * the original once, encodes a WebP ladder with sharp, and copies the results
 * into public/photos/ (gitignored, like public/ctf-assets/). Both the encoded
 * files and the album metadata are kept in .cache/immich/, which CI restores
 * between runs, so a normal build re-encodes nothing and a build where Immich is
 * unreachable still produces the same page from cache.
 */

/**
 * Longest-edge sizes emitted per photo; the largest is what the lightbox zooms
 * into. Bounding the long edge rather than the width matters for portraits: at
 * 2560px *wide* a 2:3 photo is 3835px tall, about 1.5x the bytes of a landscape
 * for detail no screen shows. The bucket is what the filename records — a
 * portrait's "-2560" rendition is 1707px wide — and the manifest carries the
 * real dimensions.
 */
const LONG_EDGES = [640, 1080, 1600, 2560, 3200];
/** Grid fallback for browsers that ignore srcset. */
const DEFAULT_WIDTH = 1080;
const WEBP_QUALITY = 80;
const CACHE_DIR = ".cache/immich";
const OUTPUT_DIR = join("public", "photos");
/** Simultaneous download+encode jobs. Encoding is the CPU-bound half. */
const CONCURRENCY = 4;
const METADATA_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
/** Assets per search page. */
const SEARCH_PAGE_SIZE = 250;
/** Backstop against a paging loop that never terminates. */
const MAX_ALBUM_ASSETS = 5_000;

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

interface ImmichAsset {
  id: string;
  type?: string;
  originalFileName?: string;
  checksum?: string;
  fileCreatedAt?: string;
  localDateTime?: string;
  exifInfo?: { description?: string | null } | null;
}

interface ImmichSharedLink {
  type?: string;
  description?: string | null;
  password?: string | null;
  assets?: ImmichAsset[];
  album?: {
    id?: string;
    albumName?: string;
    description?: string | null;
    assetCount?: number;
    /** "asc" or "desc" — the order the album is presented in inside Immich. */
    order?: string;
    /** Only older servers nested the asset list here. */
    assets?: ImmichAsset[];
  } | null;
}

/** One rendition on disk. */
interface Rendition {
  width: number;
  height: number;
  url: string;
}

export interface Photo {
  id: string;
  /** Dimensions of the largest rendition, i.e. the aspect ratio to lay out with. */
  width: number;
  height: number;
  src: string;
  /** Ascending by width, for the grid's srcset. */
  renditions: Rendition[];
  /** Largest rendition, opened by the lightbox. */
  full: Rendition;
  alt: string;
}

export interface PhotoAlbum {
  title: string;
  slug: string;
  description: string;
  order: number;
  photos: Photo[];
}

/** What .cache/immich/assets.json remembers about an already-encoded asset. */
interface CachedAsset {
  /** Immich's checksum, or "-" when the server did not report one. */
  checksum: string;
  /**
   * Longest edge of the source, after orientation. Recorded so a change to
   * LONG_EDGES invalidates the entry: without it, adding a bucket would leave
   * every cached photo stuck on the old ladder, because the existing renditions
   * all still check out.
   */
  sourceLongEdge: number;
  /** One per file in .cache/immich/renditions, ascending. */
  renditions: { bucket: number; width: number; height: number }[];
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "album"
  );
}

/**
 * Drops a leading bracketed tag from an Immich album name, so the organisational
 * marker "[Blog] Barcelona" is published as "Barcelona". Set `title` in
 * src/data/photo-albums.ts to override the name outright.
 */
function stripAlbumTag(name: string | undefined): string | undefined {
  return name?.replace(/^\s*\[[^\]]*\]\s*/, "").trim() || name;
}

/** Splits https://host/share/<key> into the API origin and the share key. */
function parseShareUrl(shareUrl: string): { origin: string; key: string } {
  const url = new URL(shareUrl);
  const key = url.pathname.split("/").filter(Boolean).pop();
  if (!key) throw new Error(`No share key in ${shareUrl}`);
  return { origin: url.origin, key };
}

async function fetchSharedLink(origin: string, key: string): Promise<ImmichSharedLink> {
  const url = `${origin}/api/shared-links/me?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "x-immich-share-key": key },
    signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET /api/shared-links/me returned ${res.status} ${res.statusText}`);
  return (await res.json()) as ImmichSharedLink;
}

/**
 * The assets of a shared album.
 *
 * An album share does not carry its asset list: /shared-links/me answers with
 * `assets: []` and an `album` object that holds only metadata, even when
 * assetCount is non-zero. The list lives behind the search API, which accepts
 * the share key and scopes the result to the shared album. Results are paged, so
 * this follows nextPage until it runs out.
 */
async function fetchAlbumAssets(
  origin: string,
  key: string,
  albumId: string,
  order: string | undefined,
): Promise<ImmichAsset[]> {
  const assets: ImmichAsset[] = [];
  let page: number | null = 1;

  while (page !== null) {
    const res = await fetch(`${origin}/api/search/metadata?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        albumIds: [albumId],
        size: SEARCH_PAGE_SIZE,
        page,
        // Matches the order the album is shown in inside Immich.
        order: order === "asc" ? "asc" : "desc",
        // Carries exifInfo.description, which becomes a photo's alt text.
        withExif: true,
      }),
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`POST /api/search/metadata returned ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as {
      assets?: { items?: ImmichAsset[]; nextPage?: number | string | null };
    };
    if (!body.assets?.items) throw new Error("search response had no assets.items");

    assets.push(...body.assets.items);
    const next = body.assets.nextPage;
    page = next === null || next === undefined || next === "" ? null : Number(next);
    if (page !== null && (!Number.isFinite(page) || assets.length >= MAX_ALBUM_ASSETS)) page = null;
  }
  return assets;
}

/**
 * Original bytes for an asset, falling back to the renditions Immich generates
 * itself. `fullsize` is the web-friendly full-resolution copy Immich makes for
 * originals browsers cannot read, so it covers the formats sharp may not decode
 * (RAW, and HEIC where libvips lacks HEIF); `preview` is the last resort, and
 * also what older servers answer with.
 */
async function downloadAsset(origin: string, key: string, id: string): Promise<Buffer> {
  const k = encodeURIComponent(key);
  const candidates = [
    `${origin}/api/assets/${id}/original?key=${k}`,
    `${origin}/api/assets/${id}/thumbnail?size=fullsize&key=${k}`,
    `${origin}/api/assets/${id}/thumbnail?size=preview&key=${k}`,
  ];
  let lastError = "no candidate URL succeeded";
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/octet-stream,image/*" },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = `${res.status} ${res.statusText} for ${new URL(url).pathname}`;
        continue;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastError = `${e} for ${new URL(url).pathname}`;
    }
  }
  throw new Error(lastError);
}

/**
 * Source dimensions after EXIF auto-orientation, which is how sharp will
 * actually write the renditions.
 */
async function orientedSize(buf: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buf).metadata();
  if (meta.autoOrient?.width && meta.autoOrient.height) {
    return { width: meta.autoOrient.width, height: meta.autoOrient.height };
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  // Orientation 5-8 include a 90 degree rotation, so the stored dimensions are
  // transposed relative to what a viewer shows.
  return (meta.orientation ?? 1) >= 5 ? { width: height, height: width } : { width, height };
}

function cachedFileName(id: string, bucket: number): string {
  return `${id}-${bucket}.webp`;
}

/** Buckets worth writing for a source this large; never upscales. */
function bucketsFor(longEdge: number): number[] {
  const fitting = LONG_EDGES.filter((edge) => edge <= longEdge);
  return fitting.length > 0 ? fitting : [longEdge];
}

function sameBuckets(renditions: { bucket: number }[], buckets: number[]): boolean {
  return (
    renditions.length === buckets.length && renditions.every((r, i) => r.bucket === buckets[i])
  );
}

export function immichLoader(options: { albums: PhotoAlbumSource[] }): Loader {
  return {
    name: "immich-photos-loader",
    async load({ store, logger, parseData }) {
      const renditionCache = join(CACHE_DIR, "renditions");
      const albumCache = join(CACHE_DIR, "albums");
      const assetIndexPath = join(CACHE_DIR, "assets.json");
      mkdirSync(renditionCache, { recursive: true });
      mkdirSync(albumCache, { recursive: true });

      let assetIndex: Record<string, CachedAsset> = {};
      if (existsSync(assetIndexPath)) {
        try {
          assetIndex = JSON.parse(readFileSync(assetIndexPath, "utf-8"));
        } catch (e) {
          logger.warn(`Ignoring unreadable ${assetIndexPath}: ${e}`);
        }
      }

      store.clear();

      const liveSlugs = new Set<string>();

      for (const [order, source] of options.albums.entries()) {
        const album = await loadAlbum(source, order, {
          logger,
          renditionCache,
          albumCache,
          assetIndex,
        });
        if (!album) continue;
        liveSlugs.add(album.slug);

        writeFileSync(assetIndexPath, JSON.stringify(assetIndex, null, 2));

        // parseData takes a plain record; PhotoAlbum is a named type with no
        // index signature, so it needs the widening assertion.
        const data = await parseData({
          id: album.slug,
          data: { ...album } as Record<string, unknown>,
        });
        store.set({ id: album.slug, data });
      }

      pruneOutputDirs(liveSlugs, logger);
    },
  };
}

/**
 * Removes album directories under public/photos that no albums claim any more.
 *
 * The slug follows the album's name, so renaming "[Blog] 2025 - Karlsruhe" to
 * "[Blog] Karlsruhe" leaves the whole old directory behind, and public/ is copied
 * into the build wholesale — the stale copy would ship. CI starts from an empty
 * public/photos so it never accumulates there; this keeps local builds honest.
 *
 * Skipped entirely when no album loaded, so an Immich outage cannot empty the
 * directory.
 */
function pruneOutputDirs(liveSlugs: Set<string>, logger: Logger): void {
  if (liveSlugs.size === 0 || !existsSync(OUTPUT_DIR)) return;

  for (const entry of readdirSync(OUTPUT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || liveSlugs.has(entry.name)) continue;
    rmSync(join(OUTPUT_DIR, entry.name), { recursive: true, force: true });
    logger.info(`Removed stale album directory public/photos/${entry.name}`);
  }
}

async function loadAlbum(
  source: PhotoAlbumSource,
  order: number,
  ctx: {
    logger: Logger;
    renditionCache: string;
    albumCache: string;
    assetIndex: Record<string, CachedAsset>;
  },
): Promise<PhotoAlbum | null> {
  const { logger, renditionCache, albumCache, assetIndex } = ctx;

  let origin: string;
  let key: string;
  try {
    ({ origin, key } = parseShareUrl(source.shareUrl));
  } catch (e) {
    logger.error(`Skipping album: ${e}`);
    return null;
  }

  // Identifies the on-disk metadata cache before the album name is known, so a
  // build with Immich down can still find it.
  const cacheId = source.slug ?? slugify(key.slice(0, 16));
  const metaPath = join(albumCache, `${cacheId}.json`);

  let link: ImmichSharedLink | null = null;
  let assets: ImmichAsset[] = [];
  try {
    link = await fetchSharedLink(origin, key);
    // Older servers hand the assets over with the share itself; current ones
    // need the extra search call.
    assets = (link.album?.assets?.length ? link.album.assets : link.assets) ?? [];
    if (assets.length === 0 && link.album?.id) {
      assets = await fetchAlbumAssets(origin, key, link.album.id, link.album.order);
    }
  } catch (e) {
    logger.warn(`Could not read share ${key.slice(0, 8)}... from Immich: ${e}`);
    link = null;
  }

  if (!link) {
    // Immich is unreachable. A restored cache still has every rendition and the
    // asset list from the last successful build, so the page is unchanged.
    if (!existsSync(metaPath)) {
      logger.error(
        `No cached metadata for share ${key.slice(0, 8)}... either - this album will be missing from /photos`,
      );
      return null;
    }
    const cached: PhotoAlbum = JSON.parse(readFileSync(metaPath, "utf-8"));
    copyRenditions(cached, renditionCache, logger);
    logger.info(`Album "${cached.title}": ${cached.photos.length} photos from cache (Immich unreachable)`);
    return { ...cached, order };
  }

  if (link.password) {
    logger.error(`Share ${key.slice(0, 8)}... is password protected; skipping`);
    return null;
  }

  const title = source.title ?? stripAlbumTag(link.album?.albumName) ?? "Photos";
  const slug = source.slug ?? slugify(title);
  const description = (link.album?.description || link.description || "").trim();

  const expected = link.album?.assetCount;
  if (expected !== undefined && expected !== assets.length) {
    logger.warn(`Album "${title}": Immich reports ${expected} assets but listed ${assets.length}`);
  }

  const images = assets.filter((a) => (a.type ?? "IMAGE").toUpperCase() === "IMAGE");
  const skipped = assets.length - images.length;
  if (skipped > 0) logger.info(`Album "${title}": skipping ${skipped} non-image asset(s)`);
  if (images.length === 0) {
    logger.warn(`Album "${title}" has no image assets`);
    return null;
  }

  const outputDir = join(OUTPUT_DIR, slug);
  mkdirSync(outputDir, { recursive: true });

  let encoded = 0;
  let reused = 0;
  let failed = 0;
  const photos = new Array<Photo | null>(images.length).fill(null);

  let next = 0;
  const worker = async () => {
    while (next < images.length) {
      const index = next++;
      const asset = images[index]!;
      try {
        photos[index] = await ensurePhoto(asset, index, {
          origin,
          key,
          title,
          slug,
          outputDir,
          renditionCache,
          assetIndex,
          onCacheHit: () => reused++,
          onEncoded: () => encoded++,
        });
      } catch (e) {
        failed++;
        logger.warn(`Album "${title}": asset ${asset.id} failed: ${e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, worker));

  const album: PhotoAlbum = {
    title,
    slug,
    description,
    order,
    photos: photos.filter((p): p is Photo => p !== null),
  };
  if (album.photos.length === 0) {
    logger.error(`Album "${title}": every asset failed; skipping`);
    return null;
  }

  writeFileSync(metaPath, JSON.stringify(album, null, 2));
  logger.info(
    `Album "${title}": ${album.photos.length} photos (${encoded} encoded, ${reused} cached` +
      `${failed > 0 ? `, ${failed} failed` : ""})`,
  );
  return album;
}

/** Copies a cached album's renditions back into public/photos/. */
function copyRenditions(album: PhotoAlbum, renditionCache: string, logger: Logger): void {
  const outputDir = join(OUTPUT_DIR, album.slug);
  mkdirSync(outputDir, { recursive: true });
  for (const photo of album.photos) {
    for (const rendition of photo.renditions) {
      const name = rendition.url.split("/").pop()!;
      const from = join(renditionCache, name);
      if (existsSync(from)) copyFileSync(from, join(outputDir, name));
      else logger.warn(`Cached rendition missing: ${from}`);
    }
  }
}

/**
 * Guarantees every rendition for one asset exists in the cache and in
 * public/photos/, downloading and encoding only when the cache misses.
 */
async function ensurePhoto(
  asset: ImmichAsset,
  index: number,
  ctx: {
    origin: string;
    key: string;
    title: string;
    slug: string;
    outputDir: string;
    renditionCache: string;
    assetIndex: Record<string, CachedAsset>;
    onCacheHit(): void;
    onEncoded(): void;
  },
): Promise<Photo> {
  const checksum = asset.checksum ?? "-";
  const cached = ctx.assetIndex[asset.id];
  // Array.isArray also rejects entries written by an older cache format, which
  // would otherwise throw on .every below.
  const cacheUsable =
    cached !== undefined &&
    cached.checksum === checksum &&
    Array.isArray(cached.renditions) &&
    cached.renditions.length > 0 &&
    typeof cached.sourceLongEdge === "number" &&
    sameBuckets(cached.renditions, bucketsFor(cached.sourceLongEdge)) &&
    cached.renditions.every((r) =>
      existsSync(join(ctx.renditionCache, cachedFileName(asset.id, r.bucket))),
    );

  let entry: CachedAsset;
  if (cacheUsable) {
    entry = cached;
    ctx.onCacheHit();
  } else {
    const buffer = await downloadAsset(ctx.origin, ctx.key, asset.id);
    const source = await orientedSize(buffer);
    if (!source.width || !source.height) throw new Error("could not read image dimensions");

    const sourceLongEdge = Math.max(source.width, source.height);
    const renditions: CachedAsset["renditions"] = [];
    for (const bucket of bucketsFor(sourceLongEdge)) {
      const { data, info } = await sharp(buffer)
        .rotate()
        // Square bounding box with fit "inside": the long edge lands on the
        // bucket whichever way round the photo is.
        .resize({ width: bucket, height: bucket, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      writeFileSync(join(ctx.renditionCache, cachedFileName(asset.id, bucket)), data);
      renditions.push({ bucket, width: info.width, height: info.height });
    }

    entry = { checksum, sourceLongEdge, renditions };
    ctx.assetIndex[asset.id] = entry;
    ctx.onEncoded();
  }

  const renditions: Rendition[] = entry.renditions
    .slice()
    .sort((a, b) => a.width - b.width)
    .map(({ bucket, width, height }) => {
      const name = cachedFileName(asset.id, bucket);
      copyFileSync(join(ctx.renditionCache, name), join(ctx.outputDir, name));
      return { width, height, url: `/photos/${ctx.slug}/${name}` };
    });

  const full = renditions[renditions.length - 1]!;
  const preferred = renditions.find((r) => r.width >= DEFAULT_WIDTH) ?? full;
  const caption = asset.exifInfo?.description?.trim();

  return {
    id: asset.id,
    width: full.width,
    height: full.height,
    src: preferred.url,
    renditions,
    full,
    alt: caption || `${ctx.title} — photo ${index + 1}`,
  };
}
