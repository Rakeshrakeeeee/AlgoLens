import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { env } from "node:process";

const runnerPort = Number.parseInt(env.ALGOLENS_RUNNER_PORT ?? "", 10) || 8765;
const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${runnerPort}`,
        changeOrigin: true,
      },
    },
    headers: {
      ...securityHeaders,
      "Content-Security-Policy": securityHeaders["Content-Security-Policy"]
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "worker-src 'self' blob:; connect-src 'self'")
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173"),
    },
  },
  preview: {
    headers: securityHeaders,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${runnerPort}`,
        changeOrigin: true,
      },
    },
  },
});
