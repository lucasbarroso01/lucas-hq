import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  build: { chunkSizeWarningLimit: 2000 },
  // config/expediente.yaml fica na raiz do repo (fonte única de horários)
  server: { fs: { allow: ['../..'] } },
})
