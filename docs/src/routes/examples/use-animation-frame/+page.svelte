<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Clock, Cog, Cpu } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseAnimationFrameDefault from '$lib/examples/use-animation-frame/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useAnimationFrame' }
        ]
    }
    if (seo) {
        seo.title = 'useAnimationFrame | Examples | Svelte Motion'
        seo.description =
            'Run animations on every frame with Svelte Motion useAnimationFrame. Access delta time and elapsed time for smooth, frame-based effects.'
        seo.ogTitle = 'useAnimationFrame'
        seo.ogTagline = 'Run animations on every frame with Svelte Motion useAnimationFrame'
        seo.ogFeatures = ['Delta Time', 'Elapsed Time', 'Frame Callback', 'Smooth Effects']
        seo.ogSlug = 'examples-use-animation-frame'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'frame-by-frame ', accent: 'cube', end: '.' },
            description:
                '`useAnimationFrame(cb)` calls `cb(time, delta)` every frame and returns a cleanup. Use `time` to drive trig functions and you get smooth, perpetual motion without component re-renders.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'rAF + direct style write' }],
            sourceUrl: `${SOURCE_URL}use-animation-frame/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseAnimationFrameDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Clock />
            <span>
                The callback receives <code>time</code> (ms since the loop started) and
                <code>delta</code> (ms since last frame). Driving rotations from
                <code>Math.sin(time / 1000)</code> gives you smooth oscillation that is frame-rate independent.
            </span>
        </li>
        <li>
            <Cog />
            <span>
                Writing directly to <code>element.style.transform</code> skips Svelte's reactivity — perfect
                when you'd otherwise trigger 60 component re-renders a second. Use this pattern for canvas
                / WebGL drivers too.
            </span>
        </li>
        <li>
            <Cpu />
            <span>
                Wrap the call in <code>$effect</code> and return the cleanup. Svelte runs the effect after
                mount, and tears down the loop when the component unmounts — no leaked rAF callbacks even
                during fast HMR.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'use-animation-frame/demos/Default.svelte',
                'use-animation-frame-default',
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
