import path from "node:path";
import { defineConfig } from "vitest/config";
import viteConfig from "../../vite.config";

/**
 * Vitest config dedicado para testes E2E.
 *
 * Reaproveita plugins e aliases do vite.config.ts mas roda em node
 * (não jsdom) com `include` apontado para `tests/e2e/**`, evitando que
 * esses testes que falam direto com Supabase local sejam capturados pelo
 * `pnpm test` (que varre `src/**`).
 */
export default defineConfig({
  ...viteConfig,
  test: {
    environment: "jsdom",
    globals: false,
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    include: ["tests/e2e/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "../../src"),
      "@shared": path.resolve(import.meta.dirname, "../../shared"),
    },
  },
});
