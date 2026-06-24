<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, MoveVertical, PanelBottomClose } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import MobileDrawerDefault from '$lib/examples/mobile-drawer/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Mobile Drawer' }
        ]
    }
    if (seo) {
        seo.title = 'Mobile Drawer | Examples | Svelte Motion'
        seo.description =
            'A theme-aware drag-to-close bottom sheet built with drag, a bound y MotionValue, and dragControls in Svelte Motion.'
        seo.ogTitle = 'Mobile Drawer'
        seo.ogTagline = 'Drag-to-close bottom sheet with a bound MotionValue'
        seo.ogFeatures = ['Drag', 'Drag Controls', 'MotionValue', 'Elasticity']
        seo.ogSlug = 'examples-mobile-drawer'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'DRAG',
            title: { prefix: 'drag to ', accent: 'close drawer', end: '.' },
            description:
                'A mobile bottom sheet you dismiss by dragging the handle down past a threshold. The gesture writes a bound y MotionValue, so the close animation continues from exactly where you let go — and it follows the light/dark theme.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'drag-to-dismiss sheet' }],
            sourceUrl: `${SOURCE_URL}mobile-drawer/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <MobileDrawerDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                Only the handle starts the drag. <code>dragListener=&#123;false&#125;</code> plus
                <code>controls.start(e)</code> on <code>pointerdown</code> means the sheet body stays
                scrollable while the grip drives the gesture.
            </span>
        </li>
        <li>
            <MoveVertical />
            <span>
                <code>drag="y"</code> writes the bound
                <code>style=&#123;&#123; y &#125;&#125;</code>
                MotionValue, so <code>onDragEnd</code> can read <code>y.get()</code> for the close
                threshold and <code>animate(y, …)</code> resumes from the dragged position.
            </span>
        </li>
        <li>
            <PanelBottomClose />
            <span>
                <code>dragConstraints</code> pins the rest position to the top, while
                <code>dragElastic=&#123;&#123; bottom: 0.5 &#125;&#125;</code> gives a soft downward pull
                before it either closes or springs back.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'mobile-drawer/demos/Default.svelte',
                'mobile-drawer-default',
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
