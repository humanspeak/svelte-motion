<script lang="ts">
    import { page } from '$app/state'
    import { afterNavigate } from '$app/navigation'
    import { HeaderV2, FooterV2, getBreadcrumbContext } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import rootPkg from '../../../../package.json'
    import { getCompetitor } from '$lib/compare-data'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'

    const { children } = $props()

    const PKG_VERSION = rootPkg.version

    const breadcrumbs = getBreadcrumbContext()

    function buildCrumbs(pathname: string) {
        // Split + filter so both `/compare` and `/compare/` collapse to
        // the index, and `/compare/<slug>` / `/compare/<slug>/` both yield
        // the same slug for the comparison lookup.
        const segments = pathname.split('/').filter(Boolean)
        if (segments.length <= 1 || segments[0] !== 'compare') {
            return [{ title: 'Compare' }]
        }
        const slug = segments[1]
        const c = getCompetitor(slug)
        const name = c?.name ?? slug
        return [{ title: 'Compare', href: '/compare' }, { title: `vs ${name}` }]
    }

    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = buildCrumbs(page.url.pathname)
    }

    afterNavigate(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = buildCrumbs(page.url.pathname)
        }
    })
</script>

<!-- `.brut-wrap` background + token swap come from docs-kit's
     brutalist.css (imported via app.css); no inline overrides needed. -->
<div class="brut-wrap flex min-h-svh flex-col">
    <HeaderV2
        config={docsConfig}
        {favicon}
        version={PKG_VERSION}
        nav={[
            { label: 'docs', href: '/docs' },
            { label: 'examples', href: '/examples' },
            { label: 'compare', href: '/compare' }
        ]}
    />
    <MotionConfig transition={{ duration: 0.5 }}>
        {@render children?.()}
    </MotionConfig>
    <FooterV2 version={PKG_VERSION} />
</div>
