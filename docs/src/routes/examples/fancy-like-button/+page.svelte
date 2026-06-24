<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, Heart, SlidersHorizontal } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import FancyLikeButtonDefault from '$lib/examples/fancy-like-button/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Fancy Like Button' }
        ]
    }
    if (seo) {
        seo.title = 'Fancy Like Button | Examples | Svelte Motion'
        seo.description =
            'Heart button with animated particle burst on press and hold using Svelte Motion.'
        seo.ogTitle = 'Fancy Like Button'
        seo.h1 = { title: 'Fancy Like Button', mode: 'sr-only' }
        seo.ogTagline =
            'Heart button with animated particle burst on press and hold using Svelte Motion'
        seo.ogFeatures = ['Particle Burst', 'Press & Hold', 'Heart Animation', 'Spring Physics']
        seo.ogSlug = 'examples-fancy-like-button'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'fancy ', accent: 'like button', end: '.' },
            description:
                'Press and hold the heart to spawn a stream of bursting hearts and circles. Each particle animates `x` / `y` / `opacity` with its own timing — many small motion components composed for one rich gesture.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'press-hold-burst' }],
            sourceUrl: `${SOURCE_URL}fancy-like-button/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <FancyLikeButtonDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                Pointer + keyboard handling lives in a single Svelte action (<code
                    >likeInteraction</code
                >) so the gesture surface stays accessible —
                <code>pointerdown</code> starts spawning, <code>pointerup</code> /
                <code>pointercancel</code> stop it, and Enter / Space mirror the same toggle for keyboard
                users.
            </span>
        </li>
        <li>
            <Heart />
            <span>
                Each burst pushes a heart and 15 circle entries into reactive
                <code>$state</code> arrays. Every motion entry animates from the button's centre to
                a random offset, then drops out of the array via a <code>setTimeout</code>
                cleanup once its animation has settled.
            </span>
        </li>
        <li>
            <SlidersHorizontal />
            <span>
                The <code>transition</code> prop accepts per-key objects — independent timings for
                <code>x</code>, <code>y</code>, and <code>opacity</code> let the particles drift sideways
                quickly, rise more slowly, and fade out last for the layered feel.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'fancy-like-button/demos/Default.svelte',
                'fancy-like-button-default',
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
