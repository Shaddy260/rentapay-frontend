import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 5173,
    // Lets an ngrok (or similar) tunnel URL reach this dev server -
    // Vite blocks unrecognized Host headers by default as a safety
    // measure. Fine for local testing; remove/tighten before any real
    // deployment.
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    proxy: {
      // Forward API calls to the backend during development
      // (avoids CORS friction; backend already has cors() enabled too)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});