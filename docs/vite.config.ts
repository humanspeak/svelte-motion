import { svelteMotionOptimize } from '@humanspeak/svelte-motion/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
// import path from 'node:path'
// import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

// const __filename = fileURLToPath(import.meta.url)

export default defineConfig({
    plugins: [
        svelteMotionOptimize(),
        tailwindcss(),
        sveltekit(),
        devtoolsJson(),
        paraglideVitePlugin({
            project: './project.inlang',
            outdir: './src/lib/paraglide',
            strategy: ['url', 'cookie', 'baseLocale'],
            disableAsyncLocalStorage: true
        })
    ],
    // docs-kit ships .svelte source (not pre-compiled JS) so vite-plugin-svelte
    // can run on its components and emit scoped styles. If Vite pre-bundles
    // the package via optimizeDeps the scoped <style> blocks get stripped and
    // every dk-* class falls back to unstyled `display: block` — the header
    // collapses, the footer collapses, etc.
    //
    // The transitive satori deps must also stay out of optimizeDeps because
    // rolldown (Vite 8's bundler) can't process the native @resvg bindings.
    optimizeDeps: {
        exclude: [
            '@humanspeak/docs-kit',
            '@humanspeak/svelte-satori-fix',
            '@resvg/resvg-js',
            'satori',
            'satori-html'
        ]
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('@humanspeak/svelte-motion')) return 'svelte-motion'
                    if (id.includes('paraglide')) return 'paraglide'
                    if (id.includes('mode-watcher')) return 'mode-watcher'
                }
            }
        }
    },
    ssr: {
        noExternal: ['flubber']
    },
    server: { port: 8320 },
    // With pnpm workspace linking, no manual alias is required
    test: {
        expect: { requireAssertions: true },
        projects: [
            {
                extends: './vite.config.ts',
                test: {
                    name: 'client',
                    environment: 'browser',
                    browser: {
                        enabled: true,
                        provider: 'playwright',
                        instances: [{ browser: 'chromium' }]
                    },
                    include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
                    exclude: ['src/lib/server/**'],
                    setupFiles: ['./vitest-setup-client.ts']
                }
            },
            {
                extends: './vite.config.ts',
                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
                }
            }
        ]
    }
})
