<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Hourglass, RotateCw, Sparkles } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import RotateDefault from '$lib/examples/rotate/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Rotate' }]
    }
    if (seo) {
        seo.title = 'Rotate | Examples | Svelte Motion'
        seo.description =
            'Continuous rotation animation with configurable easing built with Svelte Motion. A simple example demonstrating infinite transform animations.'
        seo.ogTitle = 'Rotate'
        seo.ogTagline =
            'Continuous rotation animation with configurable easing built with Svelte Motion'
        seo.ogFeatures = ['Infinite Loop', 'Transform', 'Configurable Easing', 'Simple API']
        seo.ogSlug = 'examples-rotate'
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
            tag: 'TRANSFORM',
            title: { prefix: 'simple ', accent: 'rotate', end: '.' },
            description:
                '`animate={{ rotate: 360 }}` tweens the transform rotation from its current value to 360° over the configured duration. Replay re-mounts so the rotation plays again.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'mount tween' }],
            sourceUrl: `${SOURCE_URL}rotate/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <RotateDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <RotateCw />
            <span>
                <code>rotate</code> is a pseudo-prop motion translates into a CSS
                <code>transform: rotate(…deg)</code>. Numbers default to degrees; pass
                <code>'90deg'</code>, <code>'1turn'</code>, or <code>'0.5rad'</code> if you want explicit
                units.
            </span>
        </li>
        <li>
            <Hourglass />
            <span>
                <code>transition={'{ duration: 1 }'}</code> is a 1-second linear tween. Drop in
                <code>type: 'spring'</code> for physics-based motion, or add
                <code>repeat: Infinity</code> for a continuous spinner.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                The <em>Replay</em> button bumps a key on a <code>&#123;#key&#125;</code> block — Svelte
                re-mounts the element and motion runs the entrance tween again. Same trick works for any
                one-shot animation.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'rotate-default',
                label: 'Default.svelte',
                ...manifest['rotate/demos/Default.svelte']
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
