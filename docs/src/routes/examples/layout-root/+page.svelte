<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Crosshair, Layers, MoveHorizontal, PanelLeft, Target, Unlink } from '@lucide/svelte'
    import { demoCodeSample } from '#lib/demo-loaders.js'
    import { getBreadcrumbContext } from '#lib/components/contexts/Breadcrumb/Breadcrumb.context.js'
    import { getSeoContext } from '#lib/components/contexts/Seo/Seo.context.js'
    import CenteredAnchor from '#lib/examples/layout-root/demos/CenteredAnchor.svelte'
    import SidebarTabs from '#lib/examples/layout-root/demos/SidebarTabs.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'layoutRoot' }
        ]
    }
    if (seo) {
        seo.title = 'layoutRoot & layoutAnchor | Svelte Motion'
        seo.description =
            'Animate shared layoutId elements relative to a layout root, and anchor relative layout projection to any point on the parent.'
        seo.ogTitle = 'layoutRoot & layoutAnchor'
        seo.h1 = { title: 'layoutRoot & layoutAnchor', mode: 'sr-only' }
        seo.ogTagline = 'Animate relative to the right box'
        seo.ogFeatures = ['layoutRoot', 'layoutAnchor', 'Shared Layout', 'Motion Parity']
        seo.ogSlug = 'examples-layout-root'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUT',
            title: { prefix: 'the tab bar jumps, ', accent: 'the underline glides', end: '.' },
            description:
                'Selecting Lettuce opens a sidebar, so the centred tab bar jumps left in the same update as the shared `layoutId` underline moves. The list is a `layoutRoot`: the underline animates relative to it and slides exactly one tab. Turn the root off and it flies in from where Tomato used to be.',
            snippet: sidebarSection,
            codeSnippet: sidebarCode,
            notes: sidebarNotes,
            barCells: [
                { k: 'api', v: 'layoutRoot' },
                { k: 'input', v: 'layoutId' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}layout-root/demos/SidebarTabs.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'LAYOUT',
            title: {
                prefix: 'a resizing parent, ',
                accent: 'a child that stays centred',
                end: '.'
            },
            description:
                "The parent grows and shrinks over one second; the child's own layout animation starts half a second later. Until then it only follows its parent. Anchored at `{ x: 0.5, y: 0.5 }` it never leaves the centre; with the default top-left anchor it drifts.",
            snippet: anchorSection,
            codeSnippet: anchorCode,
            notes: anchorNotes,
            barCells: [
                { k: 'api', v: 'layoutAnchor' },
                { k: 'input', v: 'layout' },
                { k: 'mode', v: 'live' }
            ],
            sourceUrl: `${SOURCE_URL}layout-root/demos/CenteredAnchor.svelte`
        }
    ]
</script>

{#snippet sidebarSection()}
    <SidebarTabs />
{/snippet}
{#snippet sidebarNotes()}
    <ul>
        <li>
            <PanelLeft />
            <span>
                The sidebar and the selection change in one update, so the list moves 110px left at
                the same moment the underline changes tab.
            </span>
        </li>
        <li>
            <Target />
            <span>
                <code>layoutRoot</code> makes the list's own layout change instant and animates the underline
                relative to it, because the previous underline was inside the list too.
            </span>
        </li>
        <li>
            <MoveHorizontal />
            <span>
                <code>layoutRoot</code> is read when the list mounts; the toggle remounts it with
                <code>{'{#key}'}</code>.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet sidebarCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-root/demos/SidebarTabs.svelte',
                'layout-root-sidebar-tabs',
                'SidebarTabs.svelte'
            )
        ]}
        columns={1}
    />
{/snippet}

{#snippet anchorSection()}
    <CenteredAnchor />
{/snippet}
{#snippet anchorNotes()}
    <ul>
        <li>
            <Crosshair />
            <span>
                <code>{'layoutAnchor={{ x: 0.5, y: 0.5 }}'}</code> measures the child's position from
                the parent's centre, so a flexbox-centred child stays centred while the parent resizes.
            </span>
        </li>
        <li>
            <Layers />
            <span>
                The default anchor is the parent's top-left corner: the child keeps its offset from
                that corner and drifts off centre.
            </span>
        </li>
        <li>
            <Unlink />
            <span>
                <code>layoutAnchor={'{false}'}</code> turns relative projection off: the child animates
                in page space on its own.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet anchorCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'layout-root/demos/CenteredAnchor.svelte',
                'layout-root-centered-anchor',
                'CenteredAnchor.svelte'
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
