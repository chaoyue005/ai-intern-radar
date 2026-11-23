import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 部署在 /ai-intern-radar/ 子路径下
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [react(), tailwindcss()],
})
