<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Clock, Crosshair, Layers, MoveRight, Repeat, Sparkles } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import KeyframesDefault from '$lib/examples/keyframes/demos/Default.svelte'
    import KeyframesWildcard from '$lib/examples/keyframes/demos/Wildcard.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Keyframes' }]
    }
    if (seo) {
        seo.title = 'Keyframes | Svelte Motion'
        seo.description =
            'Multi-property keyframe animation with scale, rotate, and borderRadius using Svelte Motion.'
        seo.ogTitle = 'Keyframes'
        seo.h1 = { title: 'Keyframes', mode: 'sr-only' }
        seo.ogTagline =
            'Multi-property keyframe animation with scale, rotate, and borderRadius using Svelte Motion'
        seo.ogFeatures = ['Multi-Property', 'Scale & Rotate', 'Border Radius', 'Sequence Animation']
        seo.ogSlug = 'examples-keyframes'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'ANIMATE',
            title: { prefix: 'multi-property ', accent: 'keyframes', end: '.' },
            description:
                'Three properties (`scale`, `rotate`, `borderRadius`) animate in lockstep as arrays of keyframes. `times` aligns each value to a normalised t — the square grows, then turns into a spinning circle, then settles back.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'keyframe-array' }],
            sourceUrl: `${SOURCE_URL}keyframes/demos/Default.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'ANIMATE',
            title: { prefix: 'wildcard ', accent: 'keyframes', end: '.' },
            description:
                "A `null` keyframe means \"the current value\" and a relative string (`'+=30'`) offsets from it — both resolve against the element's LIVE value the moment the animation starts. Drift the card, nudge it with `+=30`, then pulse `scale: [null, 1.15, 1]` mid-flight: the pulse begins from wherever the card is, without a hardcoded from-value.",
            snippet: wildcardSection,
            codeSnippet: wildcardCode,
            notes: wildcardNotes,
            barCells: [{ k: 'pattern', v: 'null · += relative' }],
            sourceUrl: `${SOURCE_URL}keyframes/demos/Wildcard.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <KeyframesDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                Pass an <strong>array</strong> as any animate value to walk through keyframes —
                <code>scale: [1, 2, 2, 1, 1]</code> traces five samples. Multiple properties with arrays
                of the same length keep step automatically.
            </span>
        </li>
        <li>
            <Clock />
            <span>
                <code>times: [0, 0.2, 0.5, 0.8, 1]</code> maps each keyframe to a normalised t in
                <code>[0, 1]</code>
                — independent of duration. Cluster keyframes near
                <code>0.5</code> for a held middle state, spread them for steady motion.
            </span>
        </li>
        <li>
            <Repeat />
            <span>
                <code>repeat: Infinity</code> + <code>repeatDelay: 1</code> loops the sequence with a
                one-second breath between cycles. Useful for ambient idle animations that don't compete
                for attention.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('keyframes/demos/Default.svelte', 'keyframes-default', 'Default.svelte')
        ]}
        columns={1}
    />
{/snippet}

{#snippet wildcardSection()}
    <KeyframesWildcard />
{/snippet}
{#snippet wildcardNotes()}
    <ul>
        <li>
            <Crosshair />
            <span>
                <code>null</code> in a keyframe means "the current value". The live element feeds
                the <strong>first</strong> keyframe at animation start — <code>scale: [null, 1.15, 1]</code>
                pulses from wherever <code>scale</code> already is, then settles at <code>1</code>.
                Later <code>null</code>s hold the previous keyframe instead (upstream
                <code>fillWildcards</code>).
            </span>
        </li>
        <li>
            <MoveRight />
            <span>
                Relative strings resolve against the live value too:
                <code>x: '+=30'</code> steps 30px right from the card's current <code>x</code>, and
                <code>'-=30'</code> steps left — no absolute target needed.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                A bare <code>x: null</code> means "hold <code>x</code> at its current value", so the
                pulse keeps the card wherever it drifted to. Because every wildcard resolves at
                <strong>start</strong>, the <code>x</code> position and the <code>scale</code> pulse compose
                instead of snapping to a hardcoded from-value.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet wildcardCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'keyframes/demos/Wildcard.svelte',
                'keyframes-wildcard',
                'Wildcard.svelte'
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
