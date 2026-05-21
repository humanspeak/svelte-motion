<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowLeftRight, Sparkles, Waves } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AnimatePresenceDefault from '$lib/examples/animate-presence/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'AnimatePresence' }
        ]
    }
    if (seo) {
        seo.title = 'AnimatePresence | Examples | Svelte Motion'
        seo.description =
            'Animate components when they are added to or removed from the DOM using Svelte Motion. Smooth enter and exit transitions made easy.'
        seo.ogTitle = 'AnimatePresence'
        seo.ogTagline =
            'Animate components when they are added to or removed from the DOM using Svelte Motion'
        seo.ogFeatures = [
            'Exit Animations',
            'Enter Transitions',
            'Conditional Rendering',
            'Smooth Unmount'
        ]
        seo.ogSlug = 'examples-animate-presence'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'ANIMATE-PRESENCE',
            title: { prefix: 'enter + exit with ', accent: 'AnimatePresence', end: '.' },
            description:
                'A `motion.*` element inside `<AnimatePresence>` runs its `exit` prop when it leaves the DOM. The same spring carries it in (`initial → animate`) and out (`animate → exit`).',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'enter + exit' }],
            sourceUrl: `${SOURCE_URL}animate-presence/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <AnimatePresenceDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Sparkles />
            <span>
                The cyan box has <code>initial</code>, <code>animate</code>, and <code>exit</code>
                props. On mount, motion tweens from <code>initial → animate</code>; on unmount
                inside <code>AnimatePresence</code>, it tweens from <code>animate → exit</code> before
                the DOM node is removed.
            </span>
        </li>
        <li>
            <ArrowLeftRight />
            <span>
                Without <code>AnimatePresence</code>, a Svelte <code>&#123;#if&#125;</code> would
                tear the node down immediately and the <code>exit</code> animation would never get a
                chance to run. The wrapper holds the node alive until <code>exit</code> finishes.
            </span>
        </li>
        <li>
            <Waves />
            <span>
                The <code>transition</code> applies to all three phases — same spring (<code
                    >stiffness: 300, damping: 25</code
                >) on the way in and on the way out, so the motion feels symmetric instead of
                snappy-in / linear-out.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'animate-presence-default',
                label: 'Default.svelte',
                ...manifest['animate-presence/demos/Default.svelte']
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
