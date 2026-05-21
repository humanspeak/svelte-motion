<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Layers, Network, Timer } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import NotificationsStackDefault from '$lib/examples/notifications-stack/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Notifications Stack' }
        ]
    }
    if (seo) {
        seo.title = 'Notifications Stack | Examples | Svelte Motion'
        seo.description =
            'iOS-style notification stack with variant-based stagger animations built with Svelte Motion. Smooth enter, exit, and reorder transitions.'
        seo.ogTitle = 'Notifications Stack'
        seo.ogTagline =
            'iOS-style notification stack with variant-based stagger animations built with Svelte Motion'
        seo.ogFeatures = ['Stagger Animation', 'Exit Transitions', 'Reorder', 'iOS Style']
        seo.ogSlug = 'examples-notifications-stack'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'VARIANTS',
            title: { prefix: 'collapsing ', accent: 'notifications', end: '.' },
            description:
                'A single boolean (`isOpen`) flips the parent into a named variant. The variant cascades into every descendant — stack chrome, header, and each notification expose their own `open` / `closed` definitions and animate together.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'variant cascade' }],
            sourceUrl: `${SOURCE_URL}notifications-stack/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <NotificationsStackDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                Click any card to flip <code>isOpen</code>. The parent
                <code>motion.div</code> sets
                <code>animate=&#123;isOpen ? 'open' : 'closed'&#125;</code>
                — motion then walks the descendant tree looking for matching
                <code>variants</code> keys and animates each one.
            </span>
        </li>
        <li>
            <Network />
            <span>
                Each notification's <code>closed</code> variant is parameterised by its index — the further
                down the stack, the more it offsets, scales, and fades. So three cards collapse into a
                layered preview that re-expands cleanly.
            </span>
        </li>
        <li>
            <Timer />
            <span>
                Per-element <code>transition</code> objects let the header lead/lag the cards via
                <code>delay</code>, and each notification staggers by
                <code>i * 0.04s</code> — a single boolean still drives a feel-good cascade.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'notifications-stack-default',
                label: 'Default.svelte',
                ...manifest['notifications-stack/demos/Default.svelte']
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
