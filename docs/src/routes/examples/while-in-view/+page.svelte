<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Eye, Lock, Sparkles } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import WhileInViewDefault from '$lib/examples/while-in-view/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'While In View' }
        ]
    }
    if (seo) {
        seo.title = 'While In View | Examples | Svelte Motion'
        seo.description =
            'Animate elements when they enter or leave the viewport using Svelte Motion whileInView. Create scroll-triggered reveal and exit animations.'
        seo.ogTitle = 'While In View'
        seo.ogTagline =
            'Animate elements when they enter or leave the viewport using Svelte Motion whileInView'
        seo.ogFeatures = ['whileInView', 'Scroll Trigger', 'Viewport Detection', 'Reveal Animation']
        seo.ogSlug = 'examples-while-in-view'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SCROLL',
            title: { prefix: 'animate ', accent: 'in view', end: '.' },
            description:
                '`whileInView` is a viewport-driven gesture state. Motion mounts an IntersectionObserver and runs the animation whenever the element enters the viewport. Two cards: one re-runs every entry, the other latches once.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'whileInView gesture' }],
            sourceUrl: `${SOURCE_URL}while-in-view/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <WhileInViewDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Eye />
            <span>
                <code>whileInView</code> is one of motion's gesture states — like
                <code>whileHover</code> but triggered by the viewport. The animation runs on entry
                and reverses to <code>animate</code> (or <code>initial</code> here) on exit.
            </span>
        </li>
        <li>
            <Lock />
            <span>
                <code>viewport={'{ once: true }'}</code> latches the entrance — once the card has
                animated in, it stays put even when it scrolls out. <code>amount</code> tunes how
                much of the element must be visible; <code>margin</code> adjusts the trigger threshold.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Each card carries its own <code>transition</code> inside the
                <code>whileInView</code> target. Different from
                <code>transition</code> as a separate prop — defining it inline binds the timing to the
                gesture so it doesn't double-up with default transitions.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'while-in-view/demos/Default.svelte',
                'while-in-view-default',
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
