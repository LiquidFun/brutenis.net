/**
 * Immich albums rendered on /photos, in the order they appear here.
 *
 * The share keys are public on purpose: these are read-only "public share"
 * links, and the site self-hosts resized copies of the photos anyway (see
 * src/lib/immich-loader.ts), so nothing here is fetched by a visitor's browser.
 * Revoking a link in Immich only breaks the *next* build, not the live page.
 */
export interface PhotoAlbumSource {
  /** Public share URL, e.g. https://photos.brutenis.net/share/<key> */
  shareUrl: string;
  /** Overrides the album name Immich reports. */
  title?: string;
  /**
   * Output directory + content-collection id. Derived from the title when
   * omitted, which means renaming the album in Immich moves the files; set it
   * explicitly to keep them stable.
   */
  slug?: string;
}

export const photoAlbums: PhotoAlbumSource[] = [
  {
    shareUrl:
      "https://photos.brutenis.net/share/61f17wuI-0Z7VImz26nwodtWBZnLYr7yxbtlEXzwBug3hXYk1pysvYjaeHieHaf9vvA",
  },
  {
    shareUrl:
      "https://photos.brutenis.net/share/D2xCOlb0q1yls10FWWSgDI89IzBGUDwNWG1aIl3JtpiqHRHH8ma8V0wm92aWAEvv7wc",
  },
  {
    shareUrl:
      "https://photos.brutenis.net/share/XJ5Hp2KgNty4A8VHKx766eQYrv5NR3jwu5wkbJy7ZEVwwwYE8RbWQu92mupOYB5AKnw",
  },
];
