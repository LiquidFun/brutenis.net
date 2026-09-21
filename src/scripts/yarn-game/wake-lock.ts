// Phone screens dim and lock mid-run: on mobile the game is played by tilting,
// so the OS sees no touch input for minutes at a time and assumes you're idle.
// A screen wake lock keeps the display awake while a run is actually going.
//
// Declared locally rather than relying on lib.dom, which only grew these types
// recently. Support is Chrome/Edge/Safari 16.4+; elsewhere this is a no-op.
interface WakeLockSentinelLike extends EventTarget {
  release(): Promise<void>;
}

interface WakeLockLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

let sentinel: WakeLockSentinelLike | null = null;
let desired = false;
let inFlight = false;
let denied = false;

function api(): WakeLockLike | null {
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock ?? null;
}

async function acquire() {
  // A hidden document is always rejected, and re-requesting while one is
  // already in flight would leak the extra sentinel.
  if (sentinel || inFlight || denied || document.visibilityState !== "visible") return;
  const wakeLock = api();
  if (!wakeLock) return;

  inFlight = true;
  try {
    const s = await wakeLock.request("screen");
    // The system drops the lock on its own (tab hidden, battery saver);
    // clear our handle so we can take it back later.
    s.addEventListener("release", () => {
      if (sentinel === s) sentinel = null;
    });
    sentinel = s;
    // The run may have ended while the request was in flight.
    if (!desired) release();
  } catch {
    // Denied — battery saver, or the OS just says no. Stop asking until
    // something changes, otherwise the per-frame caller retries at 60fps.
    denied = true;
  } finally {
    inFlight = false;
  }
}

function release() {
  const s = sentinel;
  if (!s) return;
  sentinel = null;
  void s.release().catch(() => {});
}

/** Idempotent and cheap; safe to call every frame. */
export function setWakeLockDesired(on: boolean) {
  desired = on;
  if (on) void acquire();
  else release();
}

if (api()) {
  document.addEventListener("visibilitychange", () => {
    // Locks are always released when the page hides; take it back on return,
    // and give a previously denied request a fresh chance.
    if (document.visibilityState !== "visible") return;
    denied = false;
    if (desired) void acquire();
  });
}
