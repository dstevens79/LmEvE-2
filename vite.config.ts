/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type PluginOption } from "vite";
import { resolve } from "path";
import { readFileSync } from "node:fs";

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname;

export default defineConfig({
  plugins: [
    {
      name: "lmeve-server-resources",
      generateBundle() {
        for (const [source, fileName] of [
          ["server/schema/lmeve-schema.sql", "server/schema/lmeve-schema.sql"],
          ["scripts/import-sde.sh", "scripts/import-sde.sh"],
        ]) {
          this.emitFile({
            type: "asset",
            fileName,
            source: readFileSync(resolve(projectRoot, source)),
          });
        }
      },
    },
    ...(process.env.LMEVE_DEV_API === "1"
      ? [
          {
            name: "lmeve-api",
            configureServer(server: any) {
              console.log("LMeve API middleware registered");
              server.middlewares.use(async (req: any, res: any, next: any) => {
                if (!req.url?.startsWith("/api/")) return next();
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");
                if (req.method === "OPTIONS") {
                  res.statusCode = 200;
                  res.end();
                  return;
                }
                if (req.url === "/api/health" && req.method === "GET") {
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
                  return;
                }
                next();
              });
            },
          } as PluginOption,
        ]
      : []),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@phosphor-icons")) return "icons";
          if (id.includes("recharts") || id.includes("/d3")) return "charts";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("three") || id.includes("framer-motion")) return "motion";
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
