<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, Repeat, Timer } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import TapOptionsDefault from '#lib/examples/tap-options/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Tap options' }
        ]
    }
    if (seo) {
        seo.title = 'Tap options | Svelte Motion'
        seo.description =
            'Double tap, long press and auto-repeat from one tap gesture, with the tap prop’s count, hold and repeat.'
        seo.ogTitle = 'Tap options'
        seo.h1 = { title: 'Tap options', mode: 'sr-only' }
        seo.ogTagline = 'One gesture, three behaviours'
        seo.ogFeatures = ['tap.count', 'tap.hold', 'tap.repeat', 'Motion Parity']
        seo.ogSlug = 'examples-tap-options'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'double tap, long press and ', accent: 'repeat', end: '.' },
            description:
                'The heart needs a quick double tap, delete needs a half-second hold, and the stepper keeps counting while held. `whileTap` starts on the first press in every case.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'tap' },
                { k: 'input', v: 'pointer · keyboard' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}tap-options/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <TapOptionsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                <code>count</code> needs that many quick presses; a slow second press fires
                <code>onTapCancel</code>.
            </span>
        </li>
        <li>
            <Timer />
            <span>
                <code>hold</code> needs the press held that many seconds; letting go early cancels.
            </span>
        </li>
        <li>
            <Repeat />
            <span>
                <code>repeat</code> fires <code>onTap</code> every interval while held, and
                <code>whileTap</code> stays on.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'tap-options/demos/Default.svelte',
                'tap-options-default',
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
