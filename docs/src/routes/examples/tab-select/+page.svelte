<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { ArrowLeftRight, Eye, Hand } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import TabSelectDefault from '$lib/examples/tab-select/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Tab Select' }
        ]
    }
    if (seo) {
        seo.title = 'Tab Select | Examples | Svelte Motion'
        seo.description =
            'Animated tab selector using layoutId for a shared indicator that slides between tabs in Svelte Motion.'
        seo.ogTitle = 'Tab Select'
        seo.ogTagline =
            'Animated tab selector using layoutId for a shared indicator that slides between tabs'
        seo.ogFeatures = ['layoutId', 'Shared Indicator', 'Tab Navigation', 'Slide Animation']
        seo.ogSlug = 'examples-tab-select'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'LAYOUTID',
            title: { prefix: 'sliding ', accent: 'indicator', end: '.' },
            description:
                'A pink indicator slides between tabs on every click. Only the active tab renders one; sharing a `layoutId` lets motion animate the indicator across tab boundaries instead of mount-unmount-flash.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'layoutId-indicator' }],
            sourceUrl: `${SOURCE_URL}tab-select/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <TabSelectDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <ArrowLeftRight />
            <span>
                The indicator only renders inside the active tab's <code>&lt;li&gt;</code>. As
                <code>selectedTab</code> changes, the old indicator unmounts and the new one mounts
                — sharing <code>layoutId="selected-indicator"</code> tells motion to animate from the
                old position to the new one instead of fading out / in.
            </span>
        </li>
        <li>
            <Eye />
            <span>
                <code>&lt;AnimatePresence&gt;</code> wraps the conditional render so motion gets a chance
                to coordinate the handoff. Without it the indicator would still animate position, but
                the mount/unmount lifecycle wouldn't have a clean exit window.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                Each tab button stacks two gesture props — <code>whileTap</code> for press feedback
                and <code>whileFocus</code> for keyboard navigation. Plain object form on both; nothing
                fancier needed.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'tab-select/demos/Default.svelte',
                'tab-select-default',
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
