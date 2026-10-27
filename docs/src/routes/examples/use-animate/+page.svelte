<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Bookmark, Crosshair, ListOrdered, Rewind, Wand2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseAnimateDefault from '$lib/examples/use-animate/demos/Default.svelte'
    import UseAnimateTimeline from '$lib/examples/use-animate/demos/Timeline.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useAnimate' }
        ]
    }
    if (seo) {
        seo.title = 'useAnimate | Svelte Motion'
        seo.description =
            'Imperative animation with a scoped CSS-selector API. Sequenced staggered list with a follow-up beat on a target button.'
        seo.ogTitle = 'useAnimate'
        seo.h1 = { title: 'useAnimate', mode: 'sr-only' }
        seo.ogTagline = 'Imperative animation with scoped selectors'
        seo.ogFeatures = ['Imperative API', 'Scoped Selectors', 'Sequences', 'Auto Cleanup']
        seo.ogSlug = 'examples-use-animate'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'imperative ', accent: 'useAnimate', end: '.' },
            description:
                '`useAnimate` returns `[scope, animate]`. Attach the scope to a subtree, then call `animate(selector, props, options)` — sequences, staggers, and selector-driven targets without any `motion.*` components.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'scope + animate(selector)' }],
            sourceUrl: `${SOURCE_URL}use-animate/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'TIMELINE',
            title: { prefix: 'mutable ', accent: 'timelines', end: '.' },
            description:
                'Since Motion 14.7, `animate()` returns a `Timeline`. Build it paused, add a segment at a label offset while it lives, play to a label, then reverse the whole thing.',
            snippet: timelineSection,
            codeSnippet: timelineCode,
            notes: timelineNotes,
            barCells: [{ k: 'pattern', v: "tl.add(item, 'mid+0.5')" }],
            sourceUrl: `${SOURCE_URL}use-animate/demos/Timeline.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseAnimateDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Crosshair />
            <span>
                Attach the scope to any node with <code>{'{@attach scope}'}</code>. Now selectors in
                <code>animate('li', …)</code> resolve only within that subtree — the same selector elsewhere
                on the page is ignored. Auto cleanup on destroy.
            </span>
        </li>
        <li>
            <ListOrdered />
            <span>
                Pass <code>animate</code> an array of <code>[selector, props, options]</code> tuples
                to sequence them. Each step starts when the previous finishes unless you override
                with <code>at: '-0.2'</code> (start 200ms before previous ends) or
                <code>at: 0</code> (parallel).
            </span>
        </li>
        <li>
            <Wand2 />
            <span>
                <code>stagger(0.08)</code> in the delay slot fans the animation across matched
                elements — first <code>li</code> starts at 0, next at 80ms, and so on. Same hook handles
                target-specific beats like the button's pop.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-animate/demos/Default.svelte',
                'use-animate-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet timelineSection()}
    <UseAnimateTimeline />
{/snippet}
{#snippet timelineNotes()}
    <ul>
        <li>
            <ListOrdered />
            <span>
                <code>tl.add(segment, at)</code> inserts a segment into a live timeline. The duration
                grows and playback continues from the same time, without a jump.
            </span>
        </li>
        <li>
            <Bookmark />
            <span>
                A string in the sequence is a label. <code>'mid+0.5'</code> places a segment half a
                second after it, and <code>tl.playTo('mid')</code> plays to it and pauses.
            </span>
        </li>
        <li>
            <Rewind />
            <span>
                <code>tl.reverse()</code> plays backwards from the current time. With
                <code>autoplay: false</code> nothing runs until you call <code>play</code>,
                <code>playTo</code> or <code>reverse</code>.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet timelineCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-animate/demos/Timeline.svelte',
                'use-animate-timeline',
                'Timeline.svelte'
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
