<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Accessibility, SlidersHorizontal, Sparkles, Waves } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AiGlowBorderDefault from '$lib/examples/ai-glow-border/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Apple Intelligence Glow Border' }
        ]
    }
    if (seo) {
        seo.title = 'Apple Intelligence Glow Border — Svelte | Svelte Motion'
        seo.description =
            'Recreate the Apple Intelligence wavy glow border (the Siri screen-edge glow effect from iOS and macOS) in Svelte — spring physics, feTurbulence noise, and SVG displacement with a Framer Motion-compatible animation library.'
        seo.ogTitle = 'Apple Intelligence Glow Border'
        seo.h1 = { title: 'Apple Intelligence Glow Border in Svelte', mode: 'sr-only' }
        seo.ogTagline = 'The Siri glow effect, rebuilt in Svelte'
        seo.ogFeatures = ['useAnimationFrame', 'useSpring', 'feTurbulence', 'feDisplacementMap']
        seo.ogSlug = 'examples-ai-glow-border'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'USEANIMATIONFRAME',
            title: { prefix: 'the ', accent: 'apple intelligence', end: ' border.' },
            description:
                'The wavy Apple Intelligence border from iOS and macOS — the Siri glow effect — rebuilt in Svelte with MotionValues. One useAnimationFrame integrator drives an SVG displacement filter: two drifting feTurbulence fields bound to feOffset MotionValues warp a thin ring band, a transform-driven conic rotor spins the colour field, and four radial-gradient blobs orbit on x/y springs. Click the card to enter the listening state — one flow multiplier boosts rotation, waviness, and glow together.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [
                { k: 'api', v: 'motion.feoffset' },
                { k: 'input', v: 'useAnimationFrame' },
                { k: 'channels', v: 'filter + transform' }
            ],
            sourceUrl: `${SOURCE_URL}ai-glow-border/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <AiGlowBorderDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Waves />
            <span>
                Two <code>feTurbulence</code> fields are offset by
                <code>motion.feoffset</code> MotionValues, averaged, then fed to
                <code>motion.fedisplacementmap</code> whose <code>attrScale</code> swells each frame —
                the SVG displacement that gives the Apple Intelligence border (the Siri glow effect) its
                rippling wavy edge.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                One <code>useAnimationFrame</code> integrator advances every channel — conic
                rotation, bounded dual-sine drift vectors, the displacement swell, and blob orbit
                targets — from integrator state kept <em>outside</em> the effect so the loop never restarts.
            </span>
        </li>
        <li>
            <SlidersHorizontal />
            <span>
                The thickness slider writes one <code>--t</code> custom property; every ring reach,
                radius, blur, and band width derives from it via <code>calc()</code>, so the whole
                glow scales from a single value.
            </span>
        </li>
        <li>
            <Accessibility />
            <span>
                <code>useReducedMotion</code> renders a static glow — the blobs are placed at their resting
                orbit spots and no frame loop runs at all.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'ai-glow-border/demos/Default.svelte',
                'ai-glow-border-default',
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
