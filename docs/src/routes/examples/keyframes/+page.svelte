<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Clock, Layers, Repeat } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import KeyframesDefault from '$lib/examples/keyframes/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Keyframes' }]
    }
    if (seo) {
        seo.title = 'Keyframes | Examples | Svelte Motion'
        seo.description =
            'Multi-property keyframe animation with scale, rotate, and borderRadius using Svelte Motion.'
        seo.ogTitle = 'Keyframes'
        seo.ogTagline =
            'Multi-property keyframe animation with scale, rotate, and borderRadius using Svelte Motion'
        seo.ogFeatures = ['Multi-Property', 'Scale & Rotate', 'Border Radius', 'Sequence Animation']
        seo.ogSlug = 'examples-keyframes'
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
            tag: 'ANIMATE',
            title: { prefix: 'multi-property ', accent: 'keyframes', end: '.' },
            description:
                'Three properties (`scale`, `rotate`, `borderRadius`) animate in lockstep as arrays of keyframes. `times` aligns each value to a normalised t — the square grows, then turns into a spinning circle, then settles back.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'keyframe-array' }],
            sourceUrl: `${SOURCE_URL}keyframes/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
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
            {
                id: 'keyframes-default',
                label: 'Default.svelte',
                ...manifest['keyframes/demos/Default.svelte']
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
