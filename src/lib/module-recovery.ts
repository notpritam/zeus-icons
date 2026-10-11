// Last resort for a tab opened before asset retention was introduced. Reload
// only once per minute; genuine offline/server failures must not loop forever.
export function installModuleRecovery() {
  window.addEventListener('vite:preloadError', event => {
    const key = 'free-icons:module-recovery';
    try {
      const previous = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - previous < 60_000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch { return; }
    event.preventDefault();
    window.location.reload();
  });
}
