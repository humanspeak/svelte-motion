<script lang="ts">
    import '../app.css'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import favicon from '$lib/assets/logo.svg'
    import BreadcrumbContext from '$lib/components/contexts/Breadcrumb/BreadcrumbContext.svelte'
    import { ModeWatcher } from 'mode-watcher'
    import { page } from '$app/stores'

    let { children } = $props()

    const canonicalUrl = $derived(`${$page.url.origin}${$page.url.pathname}`)
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <link rel="canonical" href={canonicalUrl} />
    <meta property="og:url" content={canonicalUrl} />
</svelte:head>

<ModeWatcher />
<BreadcrumbContext>
    <MotionConfig transition={{ duration: 0.5 }}>
        {@render children?.()}
    </MotionConfig>
</BreadcrumbContext>
