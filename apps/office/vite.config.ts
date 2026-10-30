import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: process.env.VITE_BASE ?? '/',
  build: { chunkSizeWarningLimit: 2000 },
  // config/expediente.yaml fica na raiz do repo (fonte única de horários)
  server: { fs: { allow: ['../..'] } },
})
