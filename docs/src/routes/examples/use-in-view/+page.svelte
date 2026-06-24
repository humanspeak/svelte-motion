<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Eye, Lock, ScanEye } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseInViewDefault from '$lib/examples/use-in-view/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'useInView' }]
    }
    if (seo) {
        seo.title = 'useInView | Examples | Svelte Motion'
        seo.description =
            'Detect viewport entry from a Svelte store with useInView. Reactive boolean store, IntersectionObserver-backed, with optional once-latch.'
        seo.ogTitle = 'useInView'
        seo.h1 = { title: 'useInView', mode: 'sr-only' }
        seo.ogTagline = 'Detect viewport entry from a Svelte store'
        seo.ogFeatures = ['Reactive Store', 'IntersectionObserver', 'Once Latch', 'SSR Safe']
        seo.ogSlug = 'examples-use-in-view'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'observing ', accent: 'viewport', end: '.' },
            description:
                '`useInView(getter, options)` returns a reactive boolean reflecting whether the observed element is intersecting its root. Scroll the panel — the top card toggles on every entry, the bottom card latches once.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'IntersectionObserver store' }],
            sourceUrl: `${SOURCE_URL}use-in-view/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseInViewDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Eye />
            <span>
                The hook takes a <strong>getter</strong> for the element so it can resolve the
                binding after mount. Internally it wires up an
                <code>IntersectionObserver</code> on the resolved root and re-uses it across bindings.
            </span>
        </li>
        <li>
            <Lock />
            <span>
                <code>once: true</code> latches: once the observer reports the element as visible,
                the store is pinned at <code>true</code> forever (well, until unmount). The bottom card
                uses this — useful for one-shot reveal animations.
            </span>
        </li>
        <li>
            <ScanEye />
            <span>
                Without <code>once</code>, the store flips back to <code>false</code> when the
                element scrolls out. Combine with <code>whileInView</code> on motion elements when you
                want the animation tied directly to viewport — this hook is for non-motion logic.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-in-view/demos/Default.svelte',
                'use-in-view-default',
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
