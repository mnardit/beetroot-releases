import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { licenseCheckPlugin } from "./scripts/third-party-licenses.mjs";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig(async () => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), licenseCheckPlugin()],
  build: {
    commonjsOptions: {
      // The language detector's Webpack bundle loads its CPU backend with require().
      dynamicRequireTargets: ["node_modules/@vscode/vscode-languagedetection/dist/lib/[0-9]*.js"],
    },
  },
  test: {
    // Bound DOM-worker startup and memory overhead on high-core developer machines.
    maxWorkers: Math.min(4, availableParallelism()),
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", ".claude/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/test/**",
        "src/vite-env.d.ts",
        "src/main.tsx",
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
