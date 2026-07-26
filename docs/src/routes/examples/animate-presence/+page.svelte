<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowLeftRight, Box, ShieldCheck, Sparkles, Waves } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AnimatePresenceDefault from '$lib/examples/animate-presence/demos/Default.svelte'
    import PresenceChildMotion from '$lib/examples/animate-presence/demos/PresenceChildMotion.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'AnimatePresence' }
        ]
    }
    if (seo) {
        seo.title = 'AnimatePresence | Svelte Motion'
        seo.description =
            'Animate components when they are added to or removed from the DOM using Svelte Motion. Smooth enter and exit transitions made easy.'
        seo.ogTitle = 'AnimatePresence'
        seo.h1 = { title: 'AnimatePresence', mode: 'sr-only' }
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
        },
        {
            figId: 'FIG-002',
            tag: 'PRESENCE-CHILD',
            title: { prefix: 'exit the ', accent: 'real node', end: '.' },
            description:
                '`PresenceChild` holds its original DOM subtree while a nested `motion.*` element runs `exit`, then removes it on exact animation completion.',
            snippet: presenceChildSection,
            codeSnippet: presenceChildCode,
            notes: presenceChildNotes,
            barCells: [{ k: 'mechanism', v: 'real node' }],
            sourceUrl: `${SOURCE_URL}animate-presence/demos/PresenceChildMotion.svelte`
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
                The unit card has <code>initial</code>, <code>animate</code>, and <code>exit</code>
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
            demoCodeSample(
                'animate-presence/demos/Default.svelte',
                'animate-presence-default',
                'Default.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet presenceChildSection()}
    <PresenceChildMotion />
{/snippet}
{#snippet presenceChildNotes()}
    <ul>
        <li>
            <Box />
            <span>
                The element that exits is the original DOM node, so live state and its VisualElement
                remain available for the whole animation.
            </span>
        </li>
        <li>
            <ShieldCheck />
            <span>
                Use this existing API when clone fidelity is not sufficient—for example,
                focus-sensitive content or a canvas-driven integration.
            </span>
        </li>
        <li>
            <ArrowLeftRight />
            <span>
                Toggling <code>present</code> back to true cancels an in-flight exit and keeps stale completion
                callbacks from removing the re-entered node.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet presenceChildCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'animate-presence/demos/PresenceChildMotion.svelte',
                'animate-presence-presence-child-motion',
                'PresenceChildMotion.svelte'
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
