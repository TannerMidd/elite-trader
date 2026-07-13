/* Apply the saved panel preference before CSS can paint the desktop layout.
   This stays external so the server's strict script-src 'self' policy remains
   intact. app.js removes the guard after it has selected the real panel page. */
(() => {
  let panel = true;
  try {
    const saved = localStorage.getItem("panelMode");
    panel = saved == null ? true : saved === "1";
  } catch (_error) {
    // If browser policy blocks storage, do not install a guard whose matching
    // app bundle may also be unable to resolve the preference.
    panel = false;
  }
  if (panel) {
    const root = document.documentElement;
    root.classList.add("panel-mode-prepaint");
    const releaseGuard = () => root.classList.remove("panel-mode-prepaint");
    // A syntax/runtime failure in the main bundle must never leave the page
    // permanently invisible. Normal startup removes the guard much earlier.
    window.addEventListener("error", releaseGuard, { once: true });
    window.addEventListener("unhandledrejection", releaseGuard, { once: true });
  }
})();
