import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // クライアントビルド成果物をサーバーの public/ に出力
    outDir: '../server/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React コアをベンダーチャンクとして分離
          vendor: ['react', 'react-dom'],
          // Inertia ランタイムを分離
          inertia: ['@inertiajs/react'],
        },
      },
    },
  },
})
