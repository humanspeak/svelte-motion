<script lang="ts">
    import { CodeReferenceV2, ExampleV2 } from '@humanspeak/docs-kit'
    import { Hourglass, MousePointerClick, Sparkles } from '@lucide/svelte'
    import type { Snippet } from 'svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import AnimatedButtonDefault from '$lib/examples/animated-button/demos/Default.svelte'
    import demoManifest from '$lib/demo-manifest.json'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Animated Button' }
        ]
    }
    if (seo) {
        seo.title = 'Animated Button | Examples | Svelte Motion'
        seo.description =
            'Build a spring-based animated button with Svelte Motion featuring press feedback, hover lift, and smooth transitions for interactive UIs.'
        seo.ogTitle = 'Animated Button'
        seo.ogTagline = 'Build a spring-based animated button with Svelte Motion'
        seo.ogFeatures = ['Spring Press', 'Hover Lift', 'Smooth Transitions', 'Interactive UI']
        seo.ogSlug = 'examples-animated-button'
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
            title: { prefix: 'mount + ', accent: 'animate', end: '.' },
            description:
                'The simplest motion lesson: declare `initial`, `animate`, and a `transition`. Motion tweens between them as the element enters. Replay to remount.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'mount tween' }],
            sourceUrl: `${SOURCE_URL}animated-button/demos/Default.svelte`
        }
    ]

    const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

{#snippet defaultSection()}
    <AnimatedButtonDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Sparkles />
            <span>
                <code>initial</code> sets the values on mount;
                <code>animate</code> is the target. Motion tweens between them when the component enters
                the DOM — no manual lifecycle wiring required.
            </span>
        </li>
        <li>
            <Hourglass />
            <span>
                <code>transition</code> controls the duration, easing, and type. Here it's a 600ms
                linear tween — swap in <code>type: 'spring'</code> for physics-based motion, or set
                <code>duration: 0</code> to skip the tween entirely.
            </span>
        </li>
        <li>
            <MousePointerClick />
            <span>
                The <em>Replay</em> button bumps a key on a <code>&#123;#key&#125;</code> block — Svelte
                tears the button down and re-mounts it, so motion runs the entrance tween again. Same
                trick works for any single-shot animation.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            {
                id: 'animated-button-default',
                label: 'Default.svelte',
                ...manifest['animated-button/demos/Default.svelte']
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
