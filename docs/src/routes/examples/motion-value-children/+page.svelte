<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { RadioTower, ScanText, Waves } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import MotionValueChildrenDefault from '$lib/examples/motion-value-children/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'MotionValue children' }
        ]
    }
    if (seo) {
        seo.title = 'MotionValue children | Examples | Svelte Motion'
        seo.description = 'Render MotionValue values as live text in motion elements.'
        seo.ogTitle = 'MotionValue children'
        seo.ogTagline = 'Live text powered directly by MotionValue'
        seo.ogFeatures = ['MotionValue', 'useTransform', 'Live Text', 'Telemetry']
        seo.ogSlug = 'examples-motion-value-children'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'MOTION-VALUE',
            title: { prefix: 'live text from ', accent: 'MotionValue children', end: '.' },
            description:
                'A MotionValue child renders its current value, then writes future changes straight to the element text. Svelte uses `children={value}` for this parity path because slot children compile to snippets.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'children={motionValue}' },
                { k: 'source', v: 'motion-dom' }
            ],
            sourceUrl: `${SOURCE_URL}motion-value-children/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <MotionValueChildrenDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ScanText />
            <span>
                Each large readout is a <code>motion.span</code> whose
                <code>children</code> prop is a transformed MotionValue.
            </span>
        </li>
        <li>
            <Waves />
            <span>
                <code>animate(progress, ...)</code> drives one source value; the labels derive formatted
                packet count, signal, latency, and phase text from it.
            </span>
        </li>
        <li>
            <RadioTower />
            <span>
                Normal slot children still work. This path only takes over when
                <code>children</code> is a MotionValue.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'motion-value-children-default',
                label: 'Default.svelte',
                ...manifest['motion-value-children/demos/Default.svelte']
            }
        ]}
        columns={1}
    />
{/snippet}

{#each sections as section, i (section.figId)}
    <ExampleV2
        figId={section.figId}
        tag={section.tag}
        title={section.title}
        description={section.description}
        mode={section.mode ?? 'live'}
        sheetLabel={formatSheetLabel(i, sections.length)}
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
