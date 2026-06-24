<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { GitFork, Sparkles, Timer } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import UseTimeDefault from '$lib/examples/use-time/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'useTime' }]
    }
    if (seo) {
        seo.title = 'useTime | Examples | Svelte Motion'
        seo.description =
            'Time-based animations using the Svelte Motion useTime reactive store. Creates smooth, continuously updating animations driven by elapsed time.'
        seo.ogTitle = 'useTime'
        seo.h1 = { title: 'useTime', mode: 'sr-only' }
        seo.ogTagline = 'Time-based animations using the Svelte Motion useTime reactive store'
        seo.ogFeatures = ['Elapsed Time', 'Frame Updates', 'Continuous Motion', 'Reactive Store']
        seo.ogSlug = 'examples-use-time'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'HOOK',
            title: { prefix: 'one timeline, ', accent: 'many motions', end: '.' },
            description:
                '`useTime()` returns a motion value of ms since the hook mounted. Derive position, rotation, scale, and colour from the same source — they all stay in lockstep because they share one clock.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'time → derived' }],
            sourceUrl: `${SOURCE_URL}use-time/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <UseTimeDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Timer />
            <span>
                <code>useTime()</code> ticks every frame from mount. Reading
                <code>$time</code> in a derived store re-runs the deriver on every update, so the orb's
                transform and colour update at display refresh rate.
            </span>
        </li>
        <li>
            <GitFork />
            <span>
                Five independent derived stores feed one element — different periods (<code
                    >t / 1000</code
                >
                vs <code>t / 1200</code>) give Lissajous-style motion, but they're
                <em>guaranteed</em> in phase because they share the same clock.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Prefer <code>useTransform</code> over <code>derived</code> when you want motion's
                interpolation machinery (clamping, output ranges). For plain math, the
                <code>svelte/store</code> helper is more familiar and equally fast.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('use-time/demos/Default.svelte', 'use-time-default', 'Default.svelte')
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
