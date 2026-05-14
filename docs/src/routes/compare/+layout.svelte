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
        if (pathname === '/compare') return [{ title: 'Compare' }]
        const slug = pathname.replace('/compare/', '')
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

<style>
    .brut-wrap {
        background: #f8fcfb;
    }
    :global(html.dark) .brut-wrap {
        background: #06090a;
    }
</style>
