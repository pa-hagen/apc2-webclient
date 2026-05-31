import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// apc2 listens on 8430 by default. Override with APC2_WS at runtime in the browser if needed
// (window.localStorage.apc2_ws = 'ws://host:port/ws'). The dev server binds 0.0.0.0 so you can
// reach it from another machine on the LAN.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
