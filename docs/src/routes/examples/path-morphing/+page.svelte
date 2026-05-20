<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Gauge, Shapes, Zap } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import PathMorphingDefault from '$lib/examples/path-morphing/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Path Morphing' }
        ]
    }
    if (seo) {
        seo.title = 'Path Morphing | Examples | Svelte Motion'
        seo.description =
            'Interactive path morphing animation using SVG shape interpolation with Svelte Motion.'
        seo.ogTitle = 'Path Morphing'
        seo.ogTagline =
            'Interactive path morphing animation using SVG shape interpolation with Svelte Motion'
        seo.ogFeatures = ['SVG Morphing', 'Shape Interpolation', 'useMotionValue', 'useTransform']
        seo.ogSlug = 'examples-path-morphing'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    type Section = {
        figId: string
        tag: string
        title: { prefix?: string; accent: string; end?: string }
        description: string
        snippet: Snippet
        codeSnippet?: Snippet
        notes?: Snippet
        mode?: 'live' | 'static'
        barCells?: { k: string; v: string }[]
        sourceUrl?: string
    }

    type ManifestEntry = {
        code: string
        lang: string
        html?: { light: string; dark: string }
    }
    const manifest = demoManifest as Record<string, ManifestEntry>

    const sections: Section[] = [
        {
            figId: 'FIG-001',
            tag: 'SVG',
            title: { prefix: 'morphing ', accent: 'svg paths', end: '.' },
            description:
                'Six icons morphing one into the next on a loop. flubber pre-computes a tween between each adjacent pair; `useTransform` reads a single progress motion value and routes to whichever interpolator is active.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'flubber + useTransform' }],
            sourceUrl: `${SOURCE_URL}path-morphing/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <PathMorphingDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Shapes />
            <span>
                Six SVG paths, plus lightning repeated at the end so the loop is seamless.
                <code>flubber.interpolate(a, b)</code> precomputes the segment-matched tween between each
                adjacent pair once — flubber is expensive per-call, so we never recompute mid-flight.
            </span>
        </li>
        <li>
            <Gauge />
            <span>
                One <code>useMotionValue(0)</code> drives the whole loop. <code>useTransform</code>
                reads its value: integer part = which interpolator, fractional part = where in the tween.
                The path string is recomputed every frame from those two pieces.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                <code>animate(0, target)</code> walks the motion value imperatively;
                <code>onComplete</code> advances <code>pathIndex</code> and the
                <code>$effect</code> picks up the next leg. <code>onDestroy</code> stops the in-flight
                animation so unmount can't strand the value.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'path-morphing-default',
                label: 'Default.svelte',
                ...manifest['path-morphing/demos/Default.svelte']
            }
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
        sheetLabel="SHEET {pad2(i + 1)} / {pad2(sections.length)}"
        barCells={section.barCells}
        sourceUrl={section.sourceUrl}
        codeSnippet={section.codeSnippet}
        codeLabel="show code"
        notes={section.notes}
    >
        {@render section.snippet()}
    </ExampleV2>
{/each}
