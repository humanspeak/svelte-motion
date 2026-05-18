<script lang="ts">
    import { BrutIndexV2 } from '@humanspeak/docs-kit'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import sitemapManifest from '$lib/sitemap-manifest.json'
    import type { PageData } from './$types'

    type ExampleData = {
        title: string
        description: string
        sourceUrl: string | null
    }

    type ExamplesData = Record<string, ExampleData>

    const { data }: { data: PageData } = $props()

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples' }]
    }
    if (seo) {
        seo.title = 'Examples | Svelte Motion'
        seo.description =
            'Interactive animation examples built with Svelte Motion. Browse hover effects, spring transitions, gesture animations, and scroll triggers.'
        seo.ogTitle = 'Examples'
        seo.ogTagline = 'Interactive animation examples built with Svelte Motion'
        seo.ogFeatures = [
            'Hover Effects',
            'Spring Transitions',
            'Gesture Animations',
            'Scroll Triggers'
        ]
        seo.ogSlug = 'examples'
    }

    const examples = $derived.by(() => {
        const exampleRoutes = Object.keys(sitemapManifest)
            .filter((route) => route.startsWith('/examples/') && route !== '/examples')
            .sort()

        return exampleRoutes.map((route) => {
            const slug = route.replace('/examples/', '')
            const exampleData = (data.examples as ExamplesData)[slug]
            const title = exampleData?.title || formatTitle(slug)
            return {
                route,
                slug,
                title,
                description:
                    exampleData?.description ||
                    `Interactive ${title.toLowerCase()} animation example`
            }
        })
    })

    function formatTitle(slug: string): string {
        return slug
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

<BrutIndexV2
    hero={{
        figLabel: 'FIG-001 · EXAMPLES INDEX',
        figId: 'FIG-001',
        sheetLabel: 'SHEET 01 / 02',
        meta: [
            { k: 'demos', v: String(examples.length) },
            { k: 'format', v: 'live examples' },
            { k: 'tone', v: 'interactive' },
            { rule: 'dashed' },
            { k: 'library', v: '@humanspeak/svelte-motion' },
            { k: 'framework', v: 'svelte 5', accent: true },
            { rule: 'dashed' }
        ],
        metaFooter: '// scroll for demos',
        kicker: '// examples / live demos',
        title: { accent: 'examples', end: '.' },
        subHtml:
            'Interactive animation demos built with <b>@humanspeak/svelte-motion</b> — spring physics, gestures, layout animations, exit animations, and scroll-linked motion. Pick a card, edit, ship.',
        ctas: [
            {
                label: 'browse animate-presence ↗',
                href: '/examples/animate-presence',
                primary: true
            },
            { label: 'get started', href: '/docs/getting-started' },
            { label: 'compare', href: '/compare' }
        ]
    }}
    lede={{
        kicker: 'FIG-002 / DEMOS',
        title: { prefix: 'pick an ', accent: 'example', suffix: '.' },
        body: 'Each page is a self-contained, copy-pasteable demo with the source you need.'
    }}
    items={examples.map((example, i) => ({
        href: example.route,
        id: `№ ${pad2(i + 1)} / ${pad2(examples.length)}`,
        title: `${example.slug}.`,
        line: example.description
    }))}
    footer={{
        big: {
            prefix: 'try ',
            accent: 'animate-presence',
            href: '/examples/animate-presence',
            hint: 'gesture + exit animations'
        }
    }}
/>
