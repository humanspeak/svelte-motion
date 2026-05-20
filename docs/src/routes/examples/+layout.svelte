<script lang="ts">
    import { enhanceCodeBlocks, ExampleLayoutV2 } from '@humanspeak/docs-kit'
    import { MotionConfig } from '@humanspeak/svelte-motion'
    import favicon from '$lib/assets/logo.svg'
    import { docsConfig } from '$lib/docs-config'
    import rootPkg from '../../../../package.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'

    const { children } = $props()
    const PKG_VERSION = rootPkg.version
</script>

<!--
    Brutalist examples shell. `ExampleLayoutV2` is the docs-kit-provided
    `.brut-wrap` surface that supplies the `--brut-bg` / `--brut-rule` /
    `--brut-accent` CSS tokens every `ExampleV2` sheet needs to render its
    hairline-bordered chrome. Without this wrapper the panel chrome
    disappears and demos float on the raw page background.

    `enhanceCodeBlocks` decorates inline `<code>` chips with the brutalist
    "filled with thin rule" treatment so references like
    `<code>whileHover</code>` inside notes columns visually pop.

    `MotionConfig` provides the same 0.6s default transition the previous
    layout shipped — preserved so existing per-example transition
    overrides keep behaving the same way.
-->
<ExampleLayoutV2
    config={docsConfig}
    {favicon}
    version={PKG_VERSION}
    nav={[
        { label: 'docs', href: '/docs' },
        { label: 'examples', href: '/examples' },
        { label: 'compare', href: '/compare' }
    ]}
>
    <div class="flex flex-1 flex-col" use:enhanceCodeBlocks>
        <MotionConfig transition={{ duration: 0.6 }}>
            {@render children?.()}
        </MotionConfig>
    </div>
</ExampleLayoutV2>

<style>
    /*
     * docs-kit's `.dk-ex-body` defaults to `flex-grow: 0`, which leaves
     * the footer strip floating mid-panel whenever the lede column is
     * taller than the demo body (notes column + description vs a small
     * interactive demo card). svelte-markdown's demos are content-heavy
     * enough — full markdown renders — that the body fills naturally
     * and the issue doesn't surface. Our motion demos are intrinsically
     * sized cards, so we force the body to claim the remaining panel
     * height; the footer then anchors to the panel bottom and the
     * demo's `min-height` shell centers the card.
     *
     * TODO(docs-kit): file an upstream issue — `.dk-ex-body` should
     * probably be `flex: 1` by default since the panel chrome relies on
     * the footer being anchored to the bottom.
     */
    :global(.dk-ex-body) {
        flex: 1 1 auto;
    }
</style>
