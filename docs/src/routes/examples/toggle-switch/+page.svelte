<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowDownUp, Sparkles, Zap } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ToggleSwitchDefault from '$lib/examples/toggle-switch/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Toggle Switch' }
        ]
    }
    if (seo) {
        seo.title = 'Toggle Switch | Svelte Motion'
        seo.description =
            'Animated toggle switch with spring physics built using Svelte Motion. Demonstrates layout animations and gesture-driven state transitions.'
        seo.ogTitle = 'Toggle Switch'
        seo.h1 = { title: 'Toggle Switch', mode: 'sr-only' }
        seo.ogTagline = 'Animated toggle switch with spring physics built using Svelte Motion'
        seo.ogFeatures = ['Layout Animation', 'Spring Physics', 'Gesture Driven', 'State Toggle']
        seo.ogSlug = 'examples-toggle-switch'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUT',
            title: { prefix: 'toggle ', accent: 'switch', end: '.' },
            description:
                'A single `layout` prop turns a CSS flex flip into a smooth FLIP animation. Each direction picks its own transition — snappy spring on the way up, playful bounce on the way down.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'flip-toggle' }],
            sourceUrl: `${SOURCE_URL}toggle-switch/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <ToggleSwitchDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ArrowDownUp />
            <span>
                Flipping <code>align-items</code> between <code>flex-end</code> and
                <code>flex-start</code> reflows the ball — adding <code>layout</code> on the
                <code>motion.div</code> turns the resulting CSS reflow into a measured FLIP animation.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                Transitions are per-direction. <code>spring</code> with high stiffness on the way up
                gives a confident snap; a custom <code>bounceEase</code> on the way down lets the ball
                settle playfully.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                The transition value is typed as <code>MotionTransition</code> — passing a custom
                easing function (anything <code>(t: number) =&gt; number</code>) works just as well
                as the built-in keywords.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'toggle-switch/demos/Default.svelte',
                'toggle-switch-default',
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
