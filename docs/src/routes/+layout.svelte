<script lang="ts">
    import '../app.css'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import BreadcrumbContext from '$lib/components/contexts/Breadcrumb/BreadcrumbContext.svelte'
    import BreadcrumbJsonLd from '$lib/components/contexts/Breadcrumb/BreadcrumbJsonLd.svelte'
    import SeoContext from '$lib/components/contexts/Seo/SeoContext.svelte'
    import SeoHead from '$lib/components/contexts/Seo/SeoHead.svelte'
    import type { SeoContext as SeoContextType } from '$lib/components/contexts/Seo/type'
    import { ModeWatcher } from 'mode-watcher'

    const SITE_NAME = 'Svelte Motion'

    const { children } = $props()

    const seo = $state<SeoContextType>({
        title: `${SITE_NAME} - Animation Library for Svelte`,
        description:
            'Svelte Motion is a Framer Motion-compatible animation library for Svelte 5. Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.'
    })
</script>

<ModeWatcher />
<BreadcrumbContext>
    <BreadcrumbJsonLd />
    <SeoContext {seo}>
        <MotionConfig transition={{ duration: 0.5 }}>
            {@render children?.()}
        </MotionConfig>
    </SeoContext>
</BreadcrumbContext>
<SeoHead {seo} />
