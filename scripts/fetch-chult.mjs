// Oliver's Chult Journal at /chult/: a static site built in its own repo, LiquidFun/chult-journal. Every push there
// becomes a release whose asset chult.tar.gz is the whole site. This script unpacks the latest release into public/chult/
// (gitignored); Astro copies public/ into dist/ like any other static file.
//
//   node scripts/fetch-chult.mjs           only if public/chult/ is missing (predev: no 20 MB download per dev start)
//   node scripts/fetch-chult.mjs --force   always (prebuild: every deploy takes the newest journal)
//
// CHULT_TAG=<release tag> pins a release instead of the latest; CHULT_URL overrides the whole URL (tests, mirrors).
// If the download fails, the last copy in public/chult/ is kept and the build goes on without failing.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const REPO = "https://github.com/LiquidFun/chult-journal/releases";
const URL = process.env.CHULT_URL
  || (process.env.CHULT_TAG ? `${REPO}/download/${process.env.CHULT_TAG}/chult.tar.gz` : `${REPO}/latest/download/chult.tar.gz`);
const OUT = "public/chult";
const TMP = ".cache/chult";

if (!process.argv.includes("--force") && existsSync(`${OUT}/index.html`)) {
  console.log(`chult: ${OUT}/ is there (npm run build, or --force, fetches the latest)`);
} else {
  try {
    const res = await fetch(URL, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tar = Buffer.from(await res.arrayBuffer());
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(`${TMP}/site`, { recursive: true });
    writeFileSync(`${TMP}/chult.tar.gz`, tar);
    execFileSync("tar", ["-xzf", `${TMP}/chult.tar.gz`, "-C", `${TMP}/site`]);
    if (!existsSync(`${TMP}/site/index.html`)) throw new Error("the archive has no index.html");
    rmSync(OUT, { recursive: true, force: true });
    renameSync(`${TMP}/site`, OUT);
    rmSync(TMP, { recursive: true, force: true });
    console.log(`chult: unpacked ${URL} into ${OUT}/ (${(tar.length / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    console.warn(`chult: could not fetch ${URL} (${e.message}); ${existsSync(`${OUT}/index.html`) ? "keeping the last copy" : "/chult/ is missing from this build"}`);
  }
}
