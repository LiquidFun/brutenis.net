/**
 * Filter a URL down to http(s), dropping anything else.
 *
 * Project and game links come from the profile README and from repo READMEs
 * fetched at build time, and land in `href` and `iframe.src`. A `javascript:`
 * URL in either is script execution on brutenis.net — which, because the admin
 * page lives on the same origin and basic auth is replayed automatically, also
 * reaches the leaderboard admin API. The sources are all our own repos, so this
 * is about not having the trust be implicit.
 *
 * The original string is returned rather than the parsed `href`, so relative
 * URLs stay relative. The dummy base is only there to give the parser
 * something to resolve against while it works out the effective scheme.
 *
 * The URL parser also handles the obfuscated forms — it strips ASCII tab and
 * newline, so "java\nscript:alert(1)" resolves to the javascript: scheme and is
 * rejected rather than sneaking through a string comparison.
 */
export function safeUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  try {
    const { protocol } = new URL(trimmed, "https://url.invalid");
    if (protocol !== "http:" && protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return trimmed;
}
