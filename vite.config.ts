import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Tauri expects a static server in dev mode
    const host = process.env.TAURI_DEV_HOST || 'localhost';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: true,
      },
      // Prevent vite from obscuring rust errors
      clearScreen: false,
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Build configuration for Tauri
      build: {
        target: 'esnext',
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
      }
    };
});
