<script lang="ts">
    import '../app.css'
    import { ModeWatcher } from 'mode-watcher'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import {
        BreadcrumbContextProvider,
        BreadcrumbJsonLd,
        SeoContextProvider,
        SeoH1,
        SeoHead,
        type SeoContext
    } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    const { children } = $props()

    const seo = $state<SeoContext>({})
</script>

<ModeWatcher />
<SeoContextProvider {seo}>
    <SeoHead {seo} config={docsConfig} {favicon} />
    <BreadcrumbContextProvider>
        <BreadcrumbJsonLd config={docsConfig} />
        <MotionConfig transition={{ duration: 0.5 }}>
            <!-- Renders a single per-page <h1> from the SEO context. Pages
                 whose visible chrome already carries an <h1> leave seo.h1
                 unset (nothing renders); pages built only from <ExampleV2>
                 sections set seo.h1 so screen readers and crawlers still get
                 a top-level heading. -->
            <SeoH1 {seo} />
            {@render children?.()}
        </MotionConfig>
    </BreadcrumbContextProvider>
</SeoContextProvider>
