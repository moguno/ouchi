import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const pagesDemo = mode === "pages";
  return {
    plugins: [react()],
    base: pagesDemo ? "./" : "/",
    server: {
      proxy: {
        "/api": "http://127.0.0.1:3000",
      },
    },
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
  };
});
