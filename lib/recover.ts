// Errors right after a deploy are usually a stale build (old page data or a
// chunk that no longer exists). One automatic reload fixes those; if the
// error comes back within 30s we stop and show the error screen instead.
const KEY = "tabi-compass:auto-reload-at";
const WINDOW_MS = 30_000;

export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (last && Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no storage: don't risk a reload loop
  }
  window.location.reload();
  return true;
}
