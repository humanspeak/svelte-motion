<script lang="ts">
    import {
        CodeReferenceV2,
        type DemoManifestEntry,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Accessibility, Layers, Settings } from '@lucide/svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseReducedMotionConfigDefault from '$lib/examples/use-reduced-motion-config/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useReducedMotionConfig' }
        ]
    }
    if (seo) {
        seo.title = 'useReducedMotionConfig | Examples | Svelte Motion'
        seo.description =
            'Resolve the reduced-motion policy by combining a parent <MotionConfig reducedMotion> override with the OS preference. Reactive via Svelte 5 runes.'
        seo.ogTitle = 'useReducedMotionConfig'
        seo.ogTagline = 'Combine MotionConfig override + OS preference'
        seo.ogFeatures = ['Accessibility', 'MotionConfig', 'Policy Resolution', 'SSR Safe']
        seo.ogSlug = 'examples-use-reduced-motion-config'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const manifest = demoManifest as Record<string, DemoManifestEntry>

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'resolve ', accent: 'reduced motion', end: '.' },
            description:
                '`useReducedMotionConfig()` returns a `{ current, subscribe }` object resolving the active policy: a nearest `<MotionConfig reducedMotion="...">` ancestor wins, falling back to the OS-level `prefers-reduced-motion` setting when the policy is `"user"`.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'config + a11y resolution' }],
            sourceUrl: `${SOURCE_URL}use-reduced-motion-config/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseReducedMotionConfigDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Layers />
            <span>
                Three policies on <code>&lt;MotionConfig reducedMotion&gt;</code>:
                <code>'never'</code> never reduces, <code>'always'</code> always reduces,
                <code>'user'</code> mirrors the OS preference. The default with no ancestor is
                <code>'never'</code>.
            </span>
        </li>
        <li>
            <Accessibility />
            <span>
                The resolved <code>.current</code> updates reactively when either the policy
                reassigns or the OS preference flips. Templates that read <code>.current</code> in
                <code>$derived</code> / <code>$effect</code> re-run automatically.
            </span>
        </li>
        <li>
            <Settings />
            <span>
                Useful for kiosk / preview / embed scenarios where the app needs to override the OS
                setting in either direction. Pair with <code>filterReducedMotionKeyframes</code>
                if you're hand-rolling animation paths.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'use-reduced-motion-config-default',
                label: 'Default.svelte',
                ...manifest['use-reduced-motion-config/demos/Default.svelte']
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
