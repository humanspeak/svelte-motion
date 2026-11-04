<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, MonitorSmartphone, RotateCcw, Timer, Undo2 } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import ScopeMotionBreakpointStagger from '#lib/examples/scope-motion/demos/BreakpointStagger.svelte'
    import ScopeMotionCancelReset from '#lib/examples/scope-motion/demos/CancelReset.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useScopeMotion' }
        ]
    }
    if (seo) {
        seo.title = 'useScopeMotion | Svelte Motion'
        seo.description =
            'Motion 14.5 scopes in Svelte with useScopeMotion — a staggered list that re-runs on a breakpoint, and a reset button that cancels every animation and restores inline styles.'
        seo.ogTitle = 'useScopeMotion'
        seo.h1 = { title: 'useScopeMotion', mode: 'sr-only' }
        seo.ogTagline = 'Collect animations and gestures, then stop or cancel them together'
        seo.ogFeatures = [
            'Default Transition',
            'Media Conditions',
            'cancel() Restores Styles',
            'Collected Gestures'
        ]
        seo.ogSlug = 'examples-scope-motion'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'MEDIA',
            title: { prefix: 'a stagger that ', accent: 're-runs', end: ' on a breakpoint.' },
            description:
                'Setup staggers the list in from one side and adds a hover nudge. With matchMedia conditions, crossing 800px cancels the scope and runs setup again, so the list re-staggers from the other end.',
            snippet: staggerSection,
            codeSnippet: staggerCode,
            notes: staggerNotes,
            barCells: [{ k: 'matchMedia', v: 'wide · narrow' }],
            sourceUrl: `${SOURCE_URL}scope-motion/demos/BreakpointStagger.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'CANCEL',
            title: { prefix: 'a reset button that ', accent: 'cancels', end: ' everything.' },
            description:
                'Scatter animates every tile inside the scope with run(). Reset calls cancel(): the springs stop and each tile’s inline style is restored, so they snap straight home.',
            snippet: cancelSection,
            codeSnippet: cancelCode,
            notes: cancelNotes,
            barCells: [{ k: 'method', v: 'cancel()' }],
            sourceUrl: `${SOURCE_URL}scope-motion/demos/CancelReset.svelte`
        }
    ]
</script>

{#snippet staggerSection()}
    <ScopeMotionBreakpointStagger />
{/snippet}
{#snippet staggerNotes()}
    <ul>
        <li>
            <MonitorSmartphone />
            <span>
                <code>matchMedia: &#123; wide: '&gt;=800', narrow: '&lt;800' &#125;</code> — resize
                the window across 800px and <code>scope.media</code> flips, setup runs again and the stagger
                changes direction.
            </span>
        </li>
        <li>
            <Timer />
            <span>
                The stagger <code>animate()</code> call passes only a delay. The spring comes from
                the scope's default <code>transition</code>.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                <code>hover('li', …)</code> is collected by the scope, so each re-run replaces it instead
                of stacking listeners.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet staggerCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'scope-motion/demos/BreakpointStagger.svelte',
                'scope-motion-breakpoint-stagger',
                'BreakpointStagger.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet cancelSection()}
    <ScopeMotionCancelReset />
{/snippet}
{#snippet cancelNotes()}
    <ul>
        <li>
            <Undo2 />
            <span>
                <code>cancel()</code> stops everything in the scope and restores the
                <code>style</code> attribute of every element it animated. <code>stop()</code> would freeze
                the tiles where they are instead.
            </span>
        </li>
        <li>
            <RotateCcw />
            <span>
                Event handlers reach the live scope through <code>scope.current</code>; wrapping
                work in <code>run()</code> (or <code>bind()</code>) is what gets it collected.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet cancelCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'scope-motion/demos/CancelReset.svelte',
                'scope-motion-cancel-reset',
                'CancelReset.svelte'
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
