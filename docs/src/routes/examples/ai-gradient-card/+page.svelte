<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Aperture, ExternalLink, RotateCw, Sparkles } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AiGradientCardDefault from '$lib/examples/ai-gradient-card/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'AI Gradient Card' }
        ]
    }
    if (seo) {
        seo.title = 'AI Gradient Card | Examples | Svelte Motion'
        seo.description =
            'Animated conic-gradient border with a masked glow spill, built with Svelte Motion useMotionValue, animate, and useMotionTemplate.'
        seo.ogTitle = 'AI Gradient Card'
        seo.h1 = { title: 'AI Gradient Card', mode: 'sr-only' }
        seo.ogTagline = 'Rotating conic-gradient border with a masked glow spill'
        seo.ogFeatures = ['useMotionValue', 'animate', 'useMotionTemplate', 'Conic Gradient']
        seo.ogSlug = 'examples-ai-gradient-card'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'USEMOTIONTEMPLATE',
            title: { prefix: 'rotating ', accent: 'gradient', end: ' border.' },
            description:
                'A single `turn` motion value sweeps 0 → 1 on an infinite linear loop. `useMotionTemplate` composes it into a `conic-gradient(from <turn>turn, …)` string that paints two layers — the crisp border ring and a blurred, radially-masked glow that spills a soft halo from under the card edges.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'animated-template' }],
            sourceUrl: `${SOURCE_URL}ai-gradient-card/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <AiGradientCardDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <RotateCw />
            <span>
                <code>useMotionValue(0)</code> holds the rotation. On mount,
                <code>animate(turn, [0, 1], …)</code> with <code>ease: 'linear'</code>,
                <code>duration</code>, and <code>repeat: Infinity</code> loops it forever; the returned
                controls are stopped on cleanup.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                <code>useMotionTemplate</code> interpolates <code>turn</code> into
                <code>conic-gradient(from {'${turn}'}turn, …)</code>. The composed string re-emits
                every frame, driving both gradient layers from one source.
            </span>
        </li>
        <li>
            <Aperture />
            <span>
                The glow layer reuses the same gradient, blurred and clipped with a radial
                <code>mask-image</code> so only the spill at the edges shows — a soft halo without a second
                animation.
            </span>
        </li>
        <li>
            <ExternalLink />
            <span>
                Original design: the
                <a
                    href="https://www.hover.dev/components/cards#ai-gradient-animation-card"
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    AI Gradient Animation Card by hover.dev
                </a>, ported to Svelte 5 with Svelte Motion.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'ai-gradient-card/demos/Default.svelte',
                'ai-gradient-card-default',
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
