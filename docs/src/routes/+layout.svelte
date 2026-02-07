<script lang="ts">
    import '../app.css'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import favicon from '$lib/assets/logo.svg'
    import BreadcrumbContext from '$lib/components/contexts/Breadcrumb/BreadcrumbContext.svelte'
    import Seo from '$lib/components/general/Seo.svelte'
    import { ModeWatcher } from 'mode-watcher'
    import { page } from '$app/stores'

    let { children } = $props()

    const canonicalUrl = $derived(`${$page.url.origin}${$page.url.pathname}`)

    // Extract SEO data from page data (set by +page.ts load or .svx frontmatter)
    const seoTitle = $derived(($page.data as Record<string, unknown>)?.title as string | undefined)
    const seoDescription = $derived(
        ($page.data as Record<string, unknown>)?.description as string | undefined
    )
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:url" content={canonicalUrl} />
</svelte:head>

<Seo title={seoTitle} description={seoDescription} url={canonicalUrl} />

<ModeWatcher />
<BreadcrumbContext>
    <MotionConfig transition={{ duration: 0.5 }}>
        {@render children?.()}
    </MotionConfig>
</BreadcrumbContext>
