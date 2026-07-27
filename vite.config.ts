import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

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
    // Compiles the server output into Vercel Functions; without this Vercel
    // has nothing to run and every route 404s.
    nitro(),
  ],
})

export default config
