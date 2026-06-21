<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { exampleSourceUrl } from '$lib/docs-config'
    import ScopedMotionClassesDefault from '$lib/examples/scoped-motion-classes/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Scoped Motion Classes' }
        ]
    }
    if (seo) {
        seo.title = 'Scoped Motion Classes | Examples | Svelte Motion'
        seo.description =
            'A live Svelte Motion example using @humanspeak/svelte-scoped-props to keep component-scoped CSS selectors alive on motion components.'
        seo.ogTitle = 'Scoped Motion Classes'
        seo.ogTagline = 'Parent-scoped CSS on motion components'
        seo.ogFeatures = ['scoped:class', 'motion.h2', 'Svelte CSS', 'Compiler Safe']
        seo.ogSlug = 'examples-scoped-motion-classes'
    }

    const demoKey = 'scoped-motion-classes/demos/Default.svelte' as Parameters<
        typeof demoCodeSample
    >[0]
</script>

{#snippet scopedCode()}
    <CodeReferenceV2
        samples={[demoCodeSample(demoKey, 'scoped-motion-classes-default', 'Default.svelte')]}
        columns={1}
    />
{/snippet}

<ExampleV2
    figId="FIG-001"
    tag="SCOPED CSS"
    title={{ prefix: 'motion ', accent: 'classes', end: '.' }}
    description="A parent-scoped `.headline` selector styles both a native heading and a `motion.h2`. The motion component uses `scoped:class` so Svelte sees the selector as used and keeps the generated CSS."
    sheetLabel="SHEET 01 / 01"
    barCells={[
        { k: 'syntax', v: 'scoped:class' },
        { k: 'element', v: 'motion.h2' },
        { k: 'package', v: '@humanspeak/svelte-scoped-props' }
    ]}
    sourceUrl={exampleSourceUrl('scoped-motion-classes/demos/Default.svelte')}
    codeSnippet={scopedCode}
    codeLabel="show code"
>
    <ScopedMotionClassesDefault />
</ExampleV2>
