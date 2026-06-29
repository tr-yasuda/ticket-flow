import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // E2E / ローカル dev 時にフロント dev サーバーから API を同一オリジンで呼び出すためのプロキシ。
    // API を別ポートで起動する場合は E2E_API_PORT または VITE_API_PROXY_TARGET で上書き可能。
    proxy: {
      "/api": {
        target:
          process.env.VITE_API_PROXY_TARGET ??
          `http://localhost:${process.env.E2E_API_PORT ?? "3000"}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
