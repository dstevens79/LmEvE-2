import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    ...(process.env.LMEVE_DEV_API === '1' ? [{
      name: 'lmeve-api',
      configureServer(server: any) {
        console.log('🚀 LMeve API middleware registered');
        server.middlewares.use(async (req: any, res: any, next: any) => {
          if (!req.url?.startsWith('/api/')) return next();
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
          // Minimal stub only when explicitly enabled; otherwise let PHP handle /api
          if (req.url === '/api/health' && req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
            return;
          }
          next();
        });
      }
    } as PluginOption] : []),
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  }
});

// End of config
