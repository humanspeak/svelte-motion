<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Activity, Cpu, Signal } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import OnUpdateDefault from '$lib/examples/on-update/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'onUpdate' }]
    }
    if (seo) {
        seo.title = 'onUpdate | Svelte Motion'
        seo.description = 'Read every latest motion value once per frame with the onUpdate prop.'
        seo.ogTitle = 'onUpdate'
        seo.h1 = { title: 'onUpdate', mode: 'sr-only' }
        seo.ogTagline = 'Every value, every frame'
        seo.ogFeatures = ['onUpdate', 'Latest Values', 'Per-frame Callback', 'Motion Parity']
        seo.ogSlug = 'examples-on-update'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'CALLBACK',
            title: { prefix: 'every value, ', accent: 'every frame', end: '.' },
            description:
                'The box loops `x` and `rotate`. Its `onUpdate` prop receives every latest value once per frame, and the readout prints them as they change.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'onUpdate' },
                { k: 'input', v: 'animate={{ x, rotate }}' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}on-update/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <OnUpdateDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Activity />
            <span>
                <code>onUpdate</code> runs once per frame while any value changes, never more.
            </span>
        </li>
        <li>
            <Signal />
            <span>
                <code>latest</code> holds every value on the element, not only the one that changed.
            </span>
        </li>
        <li>
            <Cpu />
            <span>
                Having <code>onUpdate</code> keeps the element's transforms on the main thread instead
                of the compositor.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('on-update/demos/Default.svelte', 'on-update-default', 'Default.svelte')
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
