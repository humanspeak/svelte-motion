<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Box, Hand, Hourglass, ListOrdered, Package } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import LazyMotionAsyncFeatures from '#lib/examples/lazy-motion/demos/AsyncFeatures.svelte'
    import LazyMotionDefault from '#lib/examples/lazy-motion/demos/Default.svelte'
    import LazyMotionFeatureBundles from '#lib/examples/lazy-motion/demos/FeatureBundles.svelte'
    import LazyMotionReorder from '#lib/examples/lazy-motion/demos/LazyReorder.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'LazyMotion' }
        ]
    }
    if (seo) {
        seo.title = 'LazyMotion | Svelte Motion'
        seo.description =
            'Use LazyMotion, m, domMin, domAnimation, and domMax to choose the motion feature bundle for a subtree.'
        seo.ogTitle = 'LazyMotion'
        seo.h1 = { title: 'LazyMotion', mode: 'sr-only' }
        seo.ogTagline = 'Feature bundles for Svelte Motion'
        seo.ogFeatures = ['LazyMotion', 'm namespace', 'domAnimation', 'domMax']
        seo.ogSlug = 'examples-lazy-motion'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAZY',
            title: { prefix: 'load ', accent: 'features', end: ' around m.' },
            description:
                'Wrap `m.*` components in LazyMotion and pass a feature bundle. The element still animates on mount, while gesture support comes from the selected bundle.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'bundle', v: 'domAnimation' }],
            sourceUrl: `${SOURCE_URL}lazy-motion/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'BUNDLES',
            title: { prefix: 'compare ', accent: 'domMin/domAnimation/domMax', end: '.' },
            description:
                '`domMin` keeps animation only, `domAnimation` enables gestures, and `domMax` adds drag/layout behavior for the subtree.',
            snippet: bundleSection,
            codeSnippet: bundleCode,
            notes: bundleNotes,
            barCells: [{ k: 'split', v: 'min / animation / max' }],
            sourceUrl: `${SOURCE_URL}lazy-motion/demos/FeatureBundles.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'REORDER',
            title: { prefix: 'reorder ', accent: 'from the m entry', end: '.' },
            description:
                'Import `Reorder` from `@humanspeak/svelte-motion/m` and it renders `m` components, so it takes drag and layout from `<LazyMotion features={domMax} strict>` without tripping strict mode.',
            snippet: reorderSection,
            codeSnippet: reorderCode,
            notes: reorderNotes,
            barCells: [{ k: 'entry', v: '@humanspeak/svelte-motion/m' }],
            sourceUrl: `${SOURCE_URL}lazy-motion/demos/LazyReorder.svelte`
        },
        {
            figId: 'FIG-004',
            tag: 'ASYNC',
            title: { prefix: 'wait for ', accent: 'the bundle', end: '.' },
            description:
                'An `m` with no LazyMotion features renders its `initial` and does nothing else, as in Motion. Give LazyMotion an async loader and its `m` components animate in from `initial` once the bundle arrives.',
            snippet: asyncSection,
            codeSnippet: asyncCode,
            notes: asyncNotes,
            barCells: [{ k: 'features', v: '() => import(...)' }],
            sourceUrl: `${SOURCE_URL}lazy-motion/demos/AsyncFeatures.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <LazyMotionDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Package />
            <span>
                <code>LazyMotion</code> provides the active feature bundle through context.
                Descendant <code>m.*</code> elements read that context before attaching gesture, drag,
                or layout behavior.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                <code>domAnimation</code> is the usual interactive bundle: mount/update animations plus
                hover, tap, focus, pan, and in-view gestures.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'lazy-motion/demos/Default.svelte',
                'lazy-motion-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet bundleSection()}
    <LazyMotionFeatureBundles />
{/snippet}
{#snippet bundleNotes()}
    <ul>
        <li>
            <Box />
            <span>
                The same <code>m.div</code> receives different runtime capabilities depending on the
                nearest <code>LazyMotion</code> provider.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                Try hover/tap across all three cards. Drag is intentionally available only under
                <code>domMax</code>.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet bundleCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'lazy-motion/demos/FeatureBundles.svelte',
                'lazy-motion-feature-bundles',
                'FeatureBundles.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet reorderSection()}
    <LazyMotionReorder />
{/snippet}
{#snippet reorderNotes()}
    <ul>
        <li>
            <ListOrdered />
            <span>
                The main <code>Reorder</code> renders <code>motion</code> components, which always
                have every feature. Inside <code>&lt;LazyMotion strict&gt;</code> it warns once in development
                and points here.
            </span>
        </li>
        <li>
            <Package />
            <span>
                Reordering needs drag and layout, so give the <code>m</code> entry's
                <code>Reorder</code> the <code>domMax</code> bundle.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet reorderCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'lazy-motion/demos/LazyReorder.svelte',
                'lazy-motion-reorder',
                'LazyReorder.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet asyncSection()}
    <LazyMotionAsyncFeatures />
{/snippet}
{#snippet asyncNotes()}
    <ul>
        <li>
            <Box />
            <span>
                The bare <code>m.div</code> has no <code>LazyMotion</code> above it, so it has no
                animation runtime: it stays at its <code>initial</code> and ignores hover.
            </span>
        </li>
        <li>
            <Hourglass />
            <span>
                The async card renders <code>initial</code> while its loader is pending. Press "Load features"
                and it animates in from there, then responds to hover.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet asyncCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'lazy-motion/demos/AsyncFeatures.svelte',
                'lazy-motion-async-features',
                'AsyncFeatures.svelte'
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
