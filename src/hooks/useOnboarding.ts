import { useState } from "react";

const STORAGE_KEY = "beetroot_onboarding_done";

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useOnboarding(): { shouldShow: boolean; markDone: () => void } {
  const [shouldShow] = useState(() => {
    // In dev mode, always show onboarding for testing purposes
    if (import.meta.env.DEV) return true;
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  function markDone() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  return { shouldShow, markDone };
}
