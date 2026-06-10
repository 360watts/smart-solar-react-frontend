import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Allow local dev to proxy to a local backend while keeping prod as default.
  // Example:
  //   VITE_DEV_PROXY_TARGET=http://localhost:8000 npm run dev
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'https://api.360watts.com'
  const usePolling =
    env.CHOKIDAR_USEPOLLING === '1' || env.VITE_USE_POLLING === '1'

  return {
    plugins: [react(), tailwindcss()],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      watch: usePolling
        ? {
            usePolling: true,
            interval: Number(env.VITE_POLLING_INTERVAL || 1000),
          }
        : undefined,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxyTarget.startsWith('https://'),
        },
      },
    },
  }
})
