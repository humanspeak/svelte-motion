<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { CheckCircle2, ListOrdered, PauseCircle } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseAnimationControlsDefault from '$lib/examples/use-animation-controls/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useAnimationControls' }
        ]
    }
    if (seo) {
        seo.title = 'useAnimationControls | Examples | Svelte Motion'
        seo.description =
            'Legacy imperative animation controls for coordinating one or more motion components with start, set, and stop.'
        seo.ogTitle = 'useAnimationControls'
        seo.ogTagline = 'Coordinate motion components imperatively'
        seo.ogFeatures = ['Imperative Controls', 'Variants', 'Sequencing', 'Shared Subscribers']
        seo.ogSlug = 'examples-use-animation-controls'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'shared ', accent: 'animation controls', end: '.' },
            description:
                '`useAnimationControls()` returns a controls object for `animate={controls}`. Call `start`, `set`, or `stop` once and every subscribed motion component responds with its own matching variant.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'controls.start(label)' }],
            sourceUrl: `${SOURCE_URL}use-animation-controls/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseAnimationControlsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ListOrdered />
            <span>
                <code>await controls.start('launch')</code> resolves after every subscribed
                <code>motion.*</code> component finishes its matching <code>launch</code> variant.
            </span>
        </li>
        <li>
            <CheckCircle2 />
            <span>
                <code>controls.set('verified')</code> jumps all subscribers to the final keyframe
                values synchronously, including <code>transitionEnd</code> values.
            </span>
        </li>
        <li>
            <PauseCircle />
            <span>
                <code>controls.stop()</code> freezes active element animations and is also called automatically
                when the hook's component unmounts.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'use-animation-controls-default',
                label: 'Default.svelte',
                ...manifest['use-animation-controls/demos/Default.svelte']
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
