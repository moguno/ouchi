import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "demo-dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 10_000,
    css: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
