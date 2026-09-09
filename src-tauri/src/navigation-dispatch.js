function dispatchNoFocusNavigation(handler, action, vk, generation, allowRetry) {
  try {
    if (typeof window[handler] === "function") {
      window[handler](action);
    } else if (allowRetry) {
      window.__TAURI_INTERNALS__
        .invoke("retry_no_focus_navigation", { vk, generation })
        .catch(() => {});
    }
  } catch (_) {}
}
