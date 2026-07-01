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
    build: {
      // Split vendor code into stable chunks so returning users only re-download
      // app code when it changes, not the entire bundle every deploy.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react-dom') || id.includes('react-router-dom') || /node_modules\/react\//.test(id)) return 'vendor-react';
            if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('recharts')) return 'vendor-charts';
            if (id.includes('framer-motion') || id.includes('lucide-react')) return 'vendor-ui';
            if (id.includes('/axios/') || id.includes('date-fns')) return 'vendor-utils';
          },
        },
      },
      // Warn on chunks > 500 kB so regressions are caught at build time.
      chunkSizeWarningLimit: 500,
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
