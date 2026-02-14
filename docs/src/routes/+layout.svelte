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
        'Svelte Motion is a Svelte animation library for building smooth, production-grade UI animations with spring physics, gestures, and more.'
    const DEFAULT_IMAGE = 'https://motion.svelte.page/og-default.png'

    let { children } = $props()

    const seo = $state<SeoContextType>({
        title: `${SITE_NAME} - Animation Library for Svelte`,
        description: DEFAULT_DESCRIPTION
    })

    const canonicalUrl = $derived(`${$page.url.origin}${$page.url.pathname}`)
    const resolvedTitle = $derived(seo.title)
    const resolvedDescription = $derived(seo.description || DEFAULT_DESCRIPTION)
</script>

<svelte:head>
    <title>{resolvedTitle}</title>
    <meta name="description" content={resolvedDescription} />
    <link rel="icon" href={favicon} />
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:title" content={resolvedTitle} />
    <meta property="og:description" content={resolvedDescription} />
    <meta property="og:image" content={DEFAULT_IMAGE} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:url" content={canonicalUrl} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={resolvedTitle} />
    <meta name="twitter:description" content={resolvedDescription} />
    <meta name="twitter:image" content={DEFAULT_IMAGE} />
</svelte:head>

<ModeWatcher />
<BreadcrumbContext>
    <SeoContext {seo}>
        <MotionConfig transition={{ duration: 0.5 }}>
            {@render children?.()}
        </MotionConfig>
    </SeoContext>
</BreadcrumbContext>
