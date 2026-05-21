<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Accessibility, Settings, ToggleLeft } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseReducedMotionDefault from '$lib/examples/use-reduced-motion/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useReducedMotion' }
        ]
    }
    if (seo) {
        seo.title = 'useReducedMotion | Examples | Svelte Motion'
        seo.description =
            "Honor the user's prefers-reduced-motion accessibility setting with Svelte Motion useReducedMotion. A reactive store that updates live when the OS preference changes."
        seo.ogTitle = 'useReducedMotion'
        seo.ogTagline = "Honor the user's reduced-motion preference"
        seo.ogFeatures = ['Accessibility', 'Reactive Store', 'Live Updates', 'SSR Safe']
        seo.ogSlug = 'examples-use-reduced-motion'
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
            tag: 'HOOK',
            title: { prefix: 'respect ', accent: 'reduced motion', end: '.' },
            description:
                '`useReducedMotion()` returns a reactive store backed by the `(prefers-reduced-motion: reduce)` media query. Gate any non-essential animation — and add an in-page override so users can opt in/out independently.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'a11y media query' }],
            sourceUrl: `${SOURCE_URL}use-reduced-motion/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <UseReducedMotionDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Accessibility />
            <span>
                The hook subscribes to the media query and updates the store live — flip the OS
                setting and your animations respond without a reload. Critical for users with
                vestibular disorders.
            </span>
        </li>
        <li>
            <Settings />
            <span>
                In Chrome DevTools, open <em>Rendering</em> and emulate
                <code>prefers-reduced-motion: reduce</code> to verify the disabled path. Same pattern
                works in Firefox / Safari accessibility panels.
            </span>
        </li>
        <li>
            <ToggleLeft />
            <span>
                The toggle <em>OR</em>s an in-page preference against the OS setting. Effective rule
                of thumb: never disable an animation the user explicitly enabled, even if the OS
                says reduce.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'use-reduced-motion-default',
                label: 'Default.svelte',
                ...manifest['use-reduced-motion/demos/Default.svelte']
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
