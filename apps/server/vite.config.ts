import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    devServer({
      adapter,
      entry: 'src/index.ts',
    }),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: 'src/index.ts',
      output: {
        format: 'es',
        entryFileNames: 'index.js',
      },
    },
  },
})
