<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Accessibility, Keyboard, MousePointer2 } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import WhileFocusDefault from '$lib/examples/while-focus/demos/Default.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'While Focus' }
        ]
    }
    if (seo) {
        seo.title = 'While Focus | Examples | Svelte Motion'
        seo.description =
            'Animate elements when they receive keyboard focus using Svelte Motion whileFocus. Enhance accessibility with visual feedback on focus events.'
        seo.ogTitle = 'While Focus'
        seo.ogTagline =
            'Animate elements when they receive keyboard focus using Svelte Motion whileFocus'
        seo.ogFeatures = ['whileFocus', 'Accessibility', 'Keyboard Focus', 'Visual Feedback']
        seo.ogSlug = 'examples-while-focus'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'FOCUS',
            title: { prefix: 'while ', accent: 'focused', end: '.' },
            description:
                'Tab through the three elements below — `whileFocus` animates them while they hold focus and reverses on blur. Works on natively focusable elements (button, input) and anything with `tabindex`.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'focus-driven' }],
            sourceUrl: `${SOURCE_URL}while-focus/demos/Default.svelte`
        }
    ]
</script>

{#snippet defaultSection()}
    <WhileFocusDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Keyboard />
            <span>
                <code>whileFocus</code> fires for both keyboard focus (Tab) and click focus. Same
                animation shape as <code>whileHover</code> — pass keyframes (or a variant key) and the
                value lasts as long as the element holds focus.
            </span>
        </li>
        <li>
            <MousePointer2 />
            <span>
                The card uses <code>tabindex="0"</code> to opt into the focus chain — any element can
                be focusable, not just buttons and inputs. Useful for custom UI surfaces.
            </span>
        </li>
        <li>
            <Accessibility />
            <span>
                Pair <code>onFocusStart</code> / <code>onFocusEnd</code> callbacks with your own state
                if you need to react beyond the visual animation (e.g. announce to screen readers, fetch
                preview data).
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample(
                'while-focus/demos/Default.svelte',
                'while-focus-default',
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
