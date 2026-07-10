<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, MoveVertical, Waves } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ScrollProgressDefault from '$lib/examples/scroll-progress/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Scroll Progress' }
        ]
    }
    if (seo) {
        seo.title = 'Scroll Progress | Svelte Motion'
        seo.description =
            'Interactive scroll progress animation example using Svelte Motion useScroll and useSpring.'
        seo.ogTitle = 'Scroll Progress'
        seo.h1 = { title: 'Scroll Progress', mode: 'sr-only' }
        seo.ogTagline =
            'Interactive scroll progress animation example using Svelte Motion useScroll and useSpring'
        seo.ogFeatures = ['useScroll', 'useSpring', 'Progress Bar', 'Scroll-Linked']
        seo.ogSlug = 'examples-scroll-progress'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SCROLL',
            title: { prefix: 'scroll-linked ', accent: 'progress', end: '.' },
            description:
                "`useScroll` emits a 0→1 motion value tracking a container's scroll position. Pass it through `useSpring` and drive `transform: scaleX(progress)` on a bar — it grows as the user scrolls.",
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'useScroll + useSpring' }],
            sourceUrl: `${SOURCE_URL}scroll-progress/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ScrollProgressDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Gauge />
            <span>
                <code>useScroll(&#123; container &#125;)</code> returns a
                <code>scrollYProgress</code> motion value that runs 0 at the top to 1 at the bottom.
                Reading <code>$scrollYProgress</code> directly gives you the raw scroll fraction.
            </span>
        </li>
        <li>
            <Waves />
            <span>
                Wrapping it in <code>useSpring</code> turns the linear progress into a smoothed motion
                value — the bar lags slightly and overshoots gently. Drop the spring if you want strict
                1:1 scroll mapping.
            </span>
        </li>
        <li>
            <MoveVertical />
            <span>
                The container is passed as a <strong>getter</strong>
                (<code>container: () =&gt; containerEl</code>) so <code>useScroll</code> can resolve the
                bound element after mount — at script-run time the binding is still undefined.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'scroll-progress/demos/Default.svelte',
                'scroll-progress-default',
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
