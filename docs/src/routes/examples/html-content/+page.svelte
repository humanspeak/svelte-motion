<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Cog, Hash, Pause } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import HtmlContentDefault from '$lib/examples/html-content/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'HTML Content' }
        ]
    }
    if (seo) {
        seo.title = 'HTML Content | Svelte Motion'
        seo.description =
            'Animate HTML content with smooth enter and exit transitions using Svelte Motion. Demonstrates AnimatePresence with dynamic HTML elements.'
        seo.ogTitle = 'HTML Content'
        seo.h1 = { title: 'HTML Content', mode: 'sr-only' }
        seo.ogTagline =
            'Animate HTML content with smooth enter and exit transitions using Svelte Motion'
        seo.ogFeatures = ['AnimatePresence', 'Enter/Exit', 'Dynamic HTML', 'Smooth Transitions']
        seo.ogSlug = 'examples-html-content'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'ANIMATE',
            title: { prefix: 'animating ', accent: 'html content', end: '.' },
            description:
                '`animate(from, to, options)` drives any imperative value over time. `onUpdate` hands you the latest interpolated number — round it and write it into `$state` to render rich HTML on every frame.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'animate() → state' }],
            sourceUrl: `${SOURCE_URL}html-content/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <HtmlContentDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Cog />
            <span>
                <code>animate(0, 100, &#123; duration: 5 &#125;)</code> returns controls that walk
                the value imperatively. Unlike <code>motion.*</code> props which animate styles, this
                lets you drive any JS value — text, canvas, business logic.
            </span>
        </li>
        <li>
            <Hash />
            <span>
                The <code>onUpdate</code> callback fires every frame with the interpolated value. Rounding
                it before storing turns a continuous tween into an integer counter — the same trick works
                for currency, percentages, or any formatted text.
            </span>
        </li>
        <li>
            <Pause />
            <span>
                <code>controls.stop()</code> in the <code>onMount</code> cleanup halts the animation
                if the component unmounts mid-tween. Important — without it the closure keeps
                writing into <code>$state</code> after the component is gone.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'html-content/demos/Default.svelte',
                'html-content-default',
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
