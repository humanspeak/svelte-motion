<script lang="ts">
    import { HeaderV2, FooterV2 } from '@humanspeak/docs-kit'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import rootPkg from '../../../../package.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'

    const PKG_VERSION = rootPkg.version

    const { children } = $props()
</script>

<div class="flex min-h-screen flex-col justify-between bg-background">
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
    <main class="flex flex-1 flex-col">
        <MotionConfig transition={{ duration: 0.6 }}>
            {@render children?.()}
        </MotionConfig>
    </main>
    <FooterV2 version={PKG_VERSION} />
</div>
