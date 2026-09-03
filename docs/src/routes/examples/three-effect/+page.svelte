<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Box, Gauge, Layers } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ThreeEffectDefault from '$lib/examples/three-effect/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Three.js Effect' }
        ]
    }
    if (seo) {
        seo.title = 'Three.js Effect | Svelte Motion'
        seo.description =
            'Spring a mesh and ripple a shader uniform with animate() and threeEffect.'
        seo.ogTitle = 'Three.js Effect'
        seo.h1 = { title: 'Three.js Effect', mode: 'sr-only' }
        seo.ogTagline = 'Motion physics for meshes and shaders'
        seo.ogFeatures = ['threeEffect', 'Three.js', 'Shader Uniforms', 'Effect Registry']
        seo.ogSlug = 'examples-three-effect'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/three-effect/demos/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'THREE',
            title: { prefix: 'mesh motion, ', accent: 'shader ripple', end: '.' },
            description:
                'A registered threeEffect springs a torus knot while the same Motion API animates its shader progress uniform.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'threeEffect' },
                { k: 'input', v: 'animate.addEffect' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ThreeEffectDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Box />
            <span><code>animate(mesh)</code> drives Three.js transform shorthands.</span>
        </li>
        <li>
            <Gauge />
            <span><code>threeEffect</code> writes the progress MotionValue into the shader.</span>
        </li>
        <li>
            <Layers />
            <span><code>frame.preRender</code> updates both before Three.js renders.</span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'three-effect/demos/Default.svelte',
                'three-effect-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#each sections as section, index (section.figId)}
    <ExampleV2
        figId={section.figId}
        tag={section.tag}
        title={section.title}
        description={section.description}
        mode={section.mode ?? 'live'}
        sheetLabel={formatSheetLabel(index, sections.length)}
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
