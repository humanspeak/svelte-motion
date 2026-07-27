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
    import CloneVsOwned from '$lib/examples/animate-presence/demos/CloneVsOwned.svelte'
    import AnimatePresenceDefault from '$lib/examples/animate-presence/demos/Default.svelte'
    import OwnedChildMotion from '$lib/examples/animate-presence/demos/OwnedChildMotion.svelte'

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
                'The existing conditional API snapshots a removed `motion.*` element and runs its `exit` prop on a visual clone.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'enter + exit' }],
            sourceUrl: `${SOURCE_URL}animate-presence/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'OWNED-CHILD',
            title: { prefix: 'exit the ', accent: 'real node', end: '.' },
            description:
                '`present` plus a named `child` snippet lets AnimatePresence retain the original DOM subtree until its nested `motion.*` exit completes.',
            snippet: presenceChildSection,
            codeSnippet: presenceChildCode,
            notes: presenceChildNotes,
            barCells: [{ k: 'mechanism', v: 'real node' }],
            sourceUrl: `${SOURCE_URL}animate-presence/demos/OwnedChildMotion.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'MECHANISM-COMPARISON',
            title: { prefix: 'clone ghost ', accent: 'vs. live node', end: '.' },
            description:
                'Toggle each lane twice quickly. The conditional form mounts a new node beside an exiting ghost; `present={visible}` reverses the original node in place.',
            snippet: comparisonSection,
            codeSnippet: comparisonCode,
            notes: comparisonNotes,
            barCells: [{ k: 'decisive test', v: 'rapid re-entry' }],
            sourceUrl: `${SOURCE_URL}animate-presence/demos/CloneVsOwned.svelte`
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
                props. On mount, the real node tweens from <code>initial → animate</code>. On
                removal, Svelte destroys that node and AnimatePresence runs
                <code>animate → exit</code> on its captured clone.
            </span>
        </li>
        <li>
            <ArrowLeftRight />
            <span>
                Without <code>AnimatePresence</code>, a Svelte <code>&#123;#if&#125;</code> would
                tear the node down immediately and the <code>exit</code> animation would never get a chance
                to run. The conditional AnimatePresence form captures a clone before teardown and animates
                that detached snapshot.
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
    <OwnedChildMotion />
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
                Use the owned API when clone fidelity is not sufficient—for example, focus-sensitive
                content, reversible exits, or a canvas-driven integration.
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
                'animate-presence/demos/OwnedChildMotion.svelte',
                'animate-presence-owned-child-motion',
                'OwnedChildMotion.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet comparisonSection()}
    <CloneVsOwned />
{/snippet}
{#snippet comparisonNotes()}
    <ul>
        <li>
            <ArrowLeftRight />
            <span>
                Click a lane’s button twice before its exit finishes. This makes node identity
                visible instead of comparing two similar-looking one-way fades.
            </span>
        </li>
        <li>
            <Box />
            <span>
                The clone lane has two identities during rapid re-entry: a new live node and the old
                detached ghost. The owned lane keeps one identity and reverses it.
            </span>
        </li>
        <li>
            <ShieldCheck />
            <span>
                Edit each input before toggling. Only the owned lane can preserve that live browser
                state while an exit is reversed.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet comparisonCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'animate-presence/demos/CloneVsOwned.svelte',
                'animate-presence-clone-vs-owned',
                'CloneVsOwned.svelte'
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
