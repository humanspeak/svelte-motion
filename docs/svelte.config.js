import adapter from '@sveltejs/adapter-cloudflare'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'
import { createHighlighter } from 'shiki'

// Create highlighter instance
const highlighter = await createHighlighter({
    themes: ['github-light', 'one-dark-pro'],
    langs: ['javascript', 'typescript', 'svelte', 'html', 'css', 'json', 'bash', 'shell']
})

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://svelte.dev/docs/kit/integrations
    // for more information about preprocessors
    preprocess: [
        vitePreprocess(),
        mdsvex({
            highlight: {
                highlighter: async (code, lang = 'text', meta = '') => {
                    const lightHtml = highlighter.codeToHtml(code, {
                        lang,
                        theme: 'github-light'
                    })
                    const darkHtml = highlighter.codeToHtml(code, {
                        lang,
                        theme: 'one-dark-pro'
                    })

                    const titleMatch = meta?.match(/title="([^"]+)"/)
                    const title = titleMatch ? ` data-title="${titleMatch[1]}"` : ''
                    const codeBase64 = Buffer.from(code).toString('base64')

                    const combinedHtml = `
                        <div class="shiki-container" data-lang="${lang}" data-code="${codeBase64}"${title}>
                            <div class="shiki-light">${lightHtml}</div>
                            <div class="shiki-dark">${darkHtml}</div>
                        </div>
                    `

                    return `{@html ${JSON.stringify(combinedHtml)}}`
                }
            }
        })
    ],
    kit: {
        // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
        // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
        // See https://svelte.dev/docs/kit/adapters for more information about adapters.
        adapter: adapter(),
        alias: {
            $msgs: 'src/lib/paraglide/messages.js'
        },
        csp: {
            mode: 'hash',
            directives: {
                'default-src': ['self'],
                'script-src': [
                    'self',
                    'https://*.ingest.us.sentry.io',
                    'https://*.ahrefs.com',
                    'https://*.posthog.com',
                    'unsafe-inline'
                ],
                'style-src': ['self', 'unsafe-inline'],
                'img-src': ['self', 'data:', 'https:'],
                'font-src': ['self', 'data:'],
                'worker-src': ['self', 'blob:'],
                'connect-src': ['self', 'https:'],
                'frame-ancestors': ['none'],
                'form-action': ['self'],
                'base-uri': ['self'],
                'upgrade-insecure-requests': true
            }
        },
        experimental: {
            instrumentation: {
                server: true
            },
            tracing: {
                server: true
            }
        }
    },
    extensions: ['.svelte', '.svx']
}

export default config
