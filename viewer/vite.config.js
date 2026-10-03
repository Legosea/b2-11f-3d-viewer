import {defineConfig} from 'vite';

export default defineConfig({
  base: '/b2-11f-3d-viewer/',
  server: {host: '127.0.0.1', port: 5179},
  preview: {host: '127.0.0.1', port: 5179},
  build: {target: 'es2022', chunkSizeWarningLimit: 1600}
});
