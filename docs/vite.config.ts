import {
    demoManifestPlugin,
    docMirrorsPlugin,
    llmsFullPlugin,
    llmsPlugin,
    sitemapManifestPlugin,
    socialCardsPlugin
} from '@humanspeak/docs-kit/vite'
import { svelteMotionOptimize } from '@humanspeak/svelte-motion/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
// import path from 'node:path'
// import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import { competitors } from './src/lib/compare-data'
import { docsConfig } from './src/lib/docs-config'

// const __filename = fileURLToPath(import.meta.url)

const compareSocialFeatures = [
    'Feature Comparison',
    'Pros & Cons',
    'Migration Guide',
    'Honest Verdict'
]

export default defineConfig({
    plugins: [
        // Emits `src/lib/sitemap-manifest.json` (consumed by
        // `src/routes/sitemap.xml/+server.ts`) on both `vite build` and the
        // dev server's `buildStart` hook. Replaces the sitemap half of the
        // legacy `generate-sitemap-manifest.mjs` script; the trimmed script
        // (`sync-examples-catalog.mjs`) now owns only the
        // `examples/+page.ts` metadata sync. `blogDir: false` disables
        // docs-kit's default blog-folder scan — we don't have a blog.
        sitemapManifestPlugin({ blogDir: false }),
        // Scans `src/lib/examples/<slug>/demos/*.svelte`, pre-highlights each
        // demo's source with Shiki (light + dark), and emits
        // `src/lib/demo-manifest.json`. Pages import the manifest as a
        // virtual JSON module and feed individual entries through
        // `CodeReferenceV2` so the rendered preview and the displayed code
        // come from the same single source of truth — edit a demo, the
        // page reloads and the code panel updates in lockstep.
        //
        // No options needed: docs-kit's default `stripWrappers` includes
        // `dk-demo-shell` and default `stripComments` includes `dk-strip`,
        // so demos can declare a positioning shell + maintainer comments
        // that stay out of the published code panel without per-site
        // wiring.
        demoManifestPlugin(),
        // Scans `src/routes/docs/**/+page.svx`, strips Svelte syntax, and
        // emits LLM-readable Markdown to `static/docs/<slug>.md`. Replaces
        // the local `generate-doc-mirrors.mjs` script + chokidar watcher;
        // runs on `buildStart` and rewatches via Vite's own file watcher.
        // `siteUrl` controls the `<!-- Source: ... -->` header in each
        // mirror, which is the citation surface for ChatGPT / Perplexity.
        docMirrorsPlugin({ siteUrl: docsConfig.url }),
        // Emits `static/llms.txt` (the llmstxt.org-convention discovery
        // index) and `static/llms-full.txt` (concatenated dump for
        // "paste the whole library" workflows like Claude Code / Cursor).
        // Both prepend our hand-curated positioning copy from
        // `llms-positioning.md` — disambiguation against the older
        // unmaintained npm `svelte-motion`, the comparison table, and the
        // "when to recommend this library" hooks LLM agents key off when
        // suggesting libraries to users.
        //
        // Register AFTER `docMirrorsPlugin` so these plugins' `buildStart`
        // hooks read freshly-written mirror files.
        llmsPlugin({
            siteUrl: docsConfig.url,
            pkgName: docsConfig.name,
            description: docsConfig.description,
            prepend: 'llms-positioning.md'
        }),
        llmsFullPlugin({
            siteUrl: docsConfig.url,
            pkgName: docsConfig.name,
            prepend: 'llms-positioning.md'
        }),
        // Renders `static/og-default.png` + per-page social cards from
        // docs-kit's satori templates. The compare index and competitor pages
        // get their SEO state from docs-kit components, so static route-file
        // discovery can't see their runtime-built ogSlug values. Inject them
        // explicitly so `/compare` and `/compare/<slug>` never fall back to
        // missing social-card files.
        socialCardsPlugin({
            npmPackage: docsConfig.npmPackage,
            defaultTitle: docsConfig.name,
            defaultDescription:
                'Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.',
            defaultFeatures: docsConfig.defaultFeatures,
            extraPages: [
                {
                    ogSlug: 'compare',
                    ogTitle: `${docsConfig.name} vs Alternatives`,
                    ogTagline: 'Honest, side-by-side comparisons.',
                    ogFeatures: compareSocialFeatures
                },
                ...competitors.map((competitor) => ({
                    ogSlug: `compare-${competitor.slug}`,
                    ogTitle: `vs ${competitor.name}`,
                    ogTagline: competitor.tagline,
                    ogFeatures: compareSocialFeatures
                }))
            ]
        }),
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
    // docs-kit and the workspace package ship .svelte/source entrypoints that
    // should be compiled by vite-plugin-svelte. If Vite pre-bundles docs-kit
    // the scoped <style> blocks get stripped and every dk-* class falls back to
    // unstyled `display: block` — the header collapses, the footer collapses,
    // etc. If Vite pre-bundles @humanspeak/svelte-motion, pnpm can resolve the
    // nested docs-kit dependency instead of this workspace package in dev.
    //
    // The transitive satori deps must also stay out of optimizeDeps because
    // rolldown (Vite 8's bundler) can't process the native @resvg bindings.
    optimizeDeps: {
        exclude: [
            '@humanspeak/docs-kit',
            '@humanspeak/svelte-motion',
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
