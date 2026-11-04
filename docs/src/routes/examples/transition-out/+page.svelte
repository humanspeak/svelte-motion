<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Clock, LogOut, MousePointer } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import TransitionOutDefault from '#lib/examples/transition-out/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'transition.out' }
        ]
    }
    if (seo) {
        seo.title = 'transition.out | Svelte Motion'
        seo.description =
            'Choose the transition a value uses when it leaves a state, with a mount-only delay from initial.'
        seo.ogTitle = 'transition.out'
        seo.h1 = { title: 'transition.out', mode: 'sr-only' }
        seo.ogTagline = 'The way out, on your terms'
        seo.ogFeatures = ['transition.out', 'Hover End', 'Mount-only Delay', 'Motion Parity']
        seo.ogSlug = 'examples-transition-out'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'TRANSITION',
            title: { prefix: 'a delay for the ', accent: 'mount only', end: '.' },
            description:
                "The card pops in after a 0.6 s delay set by `initial`'s `transition.out`. Hover scales it up quickly, and leaving uses hover's own transition (`out: true`), with no delay.",
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'transition.out' },
                { k: 'input', v: 'initial + whileHover' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}transition-out/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <TransitionOutDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Clock />
            <span>
                On <code>initial</code>, <code>out</code> times the mount animation only, once.
            </span>
        </li>
        <li>
            <MousePointer />
            <span>
                <code>out: true</code> makes hover end reuse hover's own transition.
            </span>
        </li>
        <li>
            <LogOut />
            <span>
                Without <code>out</code>, the state being entered (<code>animate</code>) picks the
                transition.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'transition-out/demos/Default.svelte',
                'transition-out-default',
                'Default.svelte'
            )
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
