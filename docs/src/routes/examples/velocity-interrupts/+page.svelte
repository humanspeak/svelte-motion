<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Gauge, MousePointerClick, Sparkles } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import VelocityInterruptsDefault from '$lib/examples/velocity-interrupts/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Velocity Interrupts' }
        ]
    }
    if (seo) {
        seo.title = 'Velocity Interrupts | Svelte Motion'
        seo.description =
            'Interrupt a gesture spring mid-flight and the momentum carries — position AND velocity ride the same MotionValue into the next animation for a live, natural feel.'
        seo.ogTitle = 'Velocity Interrupts'
        seo.h1 = { title: 'Velocity Interrupts', mode: 'sr-only' }
        seo.ogTagline = 'Gesture springs that carry momentum across an interrupt'
        seo.ogFeatures = ['whileHover', 'whileTap', 'Spring Physics', 'Velocity Continuity']
        seo.ogSlug = 'examples-velocity-interrupts'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'momentum ', accent: 'carries', end: '.' },
            description:
                'Each gesture channel rides a persistent `MotionValue`, so interrupting a spring re-targets the SAME value — position AND velocity carry into the next animation. Flick across the card or press mid-spring and the motion continues instead of snapping to a dead start.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'velocity continuity' }],
            sourceUrl: `${SOURCE_URL}velocity-interrupts/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <VelocityInterruptsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <MousePointerClick />
            <span>
                Press while the <code>whileHover</code> spring is still climbing toward 1.4x — the
                retarget to <code>whileTap</code> 0.9 launches from the hover's upward velocity, so the
                scale keeps growing for a beat before it reverses. That overshoot-then-reverse is the
                momentum you'd feel in the real thing.
            </span>
        </li>
        <li>
            <Gauge />
            <span>
                No explicit <code>transition</code> — motion's default springs apply. Because a
                single
                <code>MotionValue</code> backs the channel across gestures, velocity is continuous through
                every hover↔tap handoff and rapid re-hover.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Nothing to wire up: the same declarative <code>whileHover</code> /
                <code>whileTap</code>
                props gain the momentum for free. Flick the pointer across the card to feel a re-hover
                carry too.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'velocity-interrupts/demos/Default.svelte',
                'velocity-interrupts-default',
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
