// 自動判斷 shared-ui 位置（本機/容器都可用）
import { existsSync, readFileSync } from 'node:fs'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const attendanceFrontendRoot = path.dirname(fileURLToPath(import.meta.url))
const sharedUiCandidates = [
  path.resolve(attendanceFrontendRoot, '0.shared-ui'),
  path.resolve(attendanceFrontendRoot, '../0.shared-ui'),
  path.resolve(attendanceFrontendRoot, '../../0.shared-ui'),
]
const sharedUiRoot =
  sharedUiCandidates.find((candidatePath) => existsSync(candidatePath)) ?? sharedUiCandidates[0]
const pkgPath = path.join(attendanceFrontendRoot, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base: '/attendance/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@shared-ui': sharedUiRoot,
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: [attendanceFrontendRoot, sharedUiRoot],
    },
    host: '0.0.0.0', // 監聽所有網路介面
    port: 5173, // 可自訂埠號
    strictPort: false, // 如果埠號被占用，自動嘗試下一個
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
