import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { sentrySvelteKit } from '@sentry/sveltekit'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
// import path from 'node:path'
// import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

// const __filename = fileURLToPath(import.meta.url)

export default defineConfig({
    plugins: [
        sentrySvelteKit({
            sourceMapsUploadOptions: {
                org: 'humanspeak',
                project: 'motion-svelte-page'
            }
        }),
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
