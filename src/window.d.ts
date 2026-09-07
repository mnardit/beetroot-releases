// Global Window augmentation for no-focus mode bridges.
// These functions are assigned in src/hooks/useKeyboardNav.ts and
// invoked directly from Rust via win.eval() (see src-tauri).
declare global {
  interface Window {
    __beetrootNav?: (direction: string) => void;
    __beetrootAction?: (action: string) => void;
  }
}

export {};
