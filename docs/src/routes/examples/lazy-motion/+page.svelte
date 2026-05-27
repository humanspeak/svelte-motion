<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Box, Hand, Package } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import LazyMotionDefault from '$lib/examples/lazy-motion/demos/Default.svelte'
    import LazyMotionFeatureBundles from '$lib/examples/lazy-motion/demos/FeatureBundles.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'LazyMotion' }
        ]
    }
    if (seo) {
        seo.title = 'LazyMotion | Examples | Svelte Motion'
        seo.description =
            'Use LazyMotion, m, domMin, domAnimation, and domMax to choose the motion feature bundle for a subtree.'
        seo.ogTitle = 'LazyMotion'
        seo.ogTagline = 'Feature bundles for Svelte Motion'
        seo.ogFeatures = ['LazyMotion', 'm namespace', 'domAnimation', 'domMax']
        seo.ogSlug = 'examples-lazy-motion'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

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
            {
                id: 'lazy-motion-default',
                label: 'Default.svelte',
                ...manifest['lazy-motion/demos/Default.svelte']
            }
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
            {
                id: 'lazy-motion-feature-bundles',
                label: 'FeatureBundles.svelte',
                ...manifest['lazy-motion/demos/FeatureBundles.svelte']
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
