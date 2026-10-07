import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser only ever talks to its own origin; the local Tavus API sits behind this proxy.
const proxy = { '/api': { target: `http://127.0.0.1:${process.env.PORT || 3001}`, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
