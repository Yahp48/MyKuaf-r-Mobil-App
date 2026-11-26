import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Geliştirmede API aynı kökenden çağrılır (çerez ve CORS sorunsuz): /api → backend :5000
const target = process.env.API_TARGET ?? "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target, changeOrigin: false },
      "/uploads": { target, changeOrigin: false },
      "/socket.io": { target, ws: true },
    },
  },
  build: { sourcemap: true, chunkSizeWarningLimit: 900 },
});
