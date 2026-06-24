<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Compass, PenTool, Repeat } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import MotionPathDefault from '$lib/examples/motion-path/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Motion Path' }
        ]
    }
    if (seo) {
        seo.title = 'Motion Path | Examples | Svelte Motion'
        seo.description =
            'Animate elements along an SVG path with offset distance using Svelte Motion. Create complex motion trajectories with minimal configuration.'
        seo.ogTitle = 'Motion Path'
        seo.h1 = { title: 'Motion Path', mode: 'sr-only' }
        seo.ogTagline =
            'Animate elements along an SVG path with offset distance using Svelte Motion'
        seo.ogFeatures = ['SVG Path', 'Offset Distance', 'Path Following', 'Trajectory']
        seo.ogSlug = 'examples-motion-path'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'SVG',
            title: { prefix: 'riding an ', accent: 'svg path', end: '.' },
            description:
                'One SVG path drives two tracks at once — `motion.path` draws itself by tweening `pathLength`, and a `motion.div` rides the same curve via CSS `offset-path` + `offsetDistance`.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'pathLength + offsetDistance' }],
            sourceUrl: `${SOURCE_URL}motion-path/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <MotionPathDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <PenTool />
            <span>
                <code>motion.path</code> tweens its <code>pathLength</code> from 0 to 1 — SVG renders
                the path with a dash array sized to the current value, so the line appears to draw itself
                stroke-by-stroke.
            </span>
        </li>
        <li>
            <Compass />
            <span>
                The box uses CSS <code>offset-path: path(…)</code> with the same path string. Motion
                tweens <code>offsetDistance</code> from 0% to 100%, which translates and rotates the element
                along the curve — no manual coordinate calc.
            </span>
        </li>
        <li>
            <Repeat />
            <span>
                One <code>transition</code> object drives both tracks (<code>duration: 4</code>,
                <code>repeat: Infinity</code>,
                <code>repeatType: 'reverse'</code>) so the stroke and the box stay in lockstep
                forward and back.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'motion-path/demos/Default.svelte',
                'motion-path-default',
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
