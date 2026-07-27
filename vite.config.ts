import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  // Served from the domain root on Vercel (no GitHub Pages subpath anymore).
  base: '/',
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    // Prerendering is off: /admin and /kunde routes are now guarded by
    // server-side beforeLoad checks against a real request/session, which
    // don't make sense to run at build time.
    tanstackStart(),
    viteReact(),
  ],
})

export default config
