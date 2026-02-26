<script lang="ts">
    import '../app.css'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import favicon from '$lib/assets/logo.svg'
    import BreadcrumbContext from '$lib/components/contexts/Breadcrumb/BreadcrumbContext.svelte'
    import SeoContext from '$lib/components/contexts/Seo/SeoContext.svelte'
    import type { SeoContext as SeoContextType } from '$lib/components/contexts/Seo/type'
    import { ModeWatcher } from 'mode-watcher'
    import { page } from '$app/stores'

    const SITE_NAME = 'Svelte Motion'
    const DEFAULT_DESCRIPTION =
        'Svelte Motion is a Framer Motion-compatible animation library for Svelte 5. Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.'
    const DEFAULT_IMAGE = 'https://motion.svelte.page/og-default.png'

    const { children } = $props()

    const seo = $state<SeoContextType>({
        title: `${SITE_NAME} - Animation Library for Svelte`,
        description: DEFAULT_DESCRIPTION
    })

    const canonicalUrl = $derived(`${$page.url.origin}${$page.url.pathname}`)
    const resolvedTitle = $derived(seo.title)
    const resolvedDescription = $derived(seo.description || DEFAULT_DESCRIPTION)

    const websiteJsonLd = `<${'script'} type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: 'https://motion.svelte.page',
        description: DEFAULT_DESCRIPTION,
        publisher: {
            '@type': 'Organization',
            name: 'Humanspeak',
            url: 'https://humanspeak.com',
            logo: 'https://humanspeak.com/humanspeak.svg'
        },
        sameAs: [
            'https://github.com/humanspeak/svelte-motion',
            'https://www.npmjs.com/package/@humanspeak/svelte-motion'
        ]
    })}</${'script'}>`
</script>

<svelte:head>
    <title>{resolvedTitle}</title>
    <meta name="description" content={resolvedDescription} />
    <link rel="icon" href={favicon} />
    <link rel="canonical" href={canonicalUrl} />
    <meta name="author" content="Humanspeak" />
    <meta property="og:title" content={resolvedTitle} />
    <meta property="og:description" content={resolvedDescription} />
    <meta property="og:image" content={DEFAULT_IMAGE} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="Svelte Motion — Framer Motion API for Svelte 5" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:url" content={canonicalUrl} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={resolvedTitle} />
    <meta name="twitter:description" content={resolvedDescription} />
    <meta name="twitter:image" content={DEFAULT_IMAGE} />
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- static JSON-LD, no user input -->
    {@html websiteJsonLd}
</svelte:head>

<ModeWatcher />
<BreadcrumbContext>
    <SeoContext {seo}>
        <MotionConfig transition={{ duration: 0.5 }}>
            {@render children?.()}
        </MotionConfig>
    </SeoContext>
</BreadcrumbContext>
