import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Reaproveita plugins (incluindo @vitejs/plugin-react, sem o qual JSX não
// é transformado em arquivos `.tsx`) e aliases do vite.config.ts para que
// os testes rodem no mesmo pipeline de transformação do app.
export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      passWithNoTests: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.{test,spec}.{ts,tsx}",
          "src/**/*.d.ts",
          "src/main.tsx",
          "src/vite-env.d.ts",
        ],
      },
    },
  })
);
