<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Archive, ShieldCheck, Sparkles, TimerReset, Trash2 } from '@lucide/svelte'
    import { demoCodeSamples } from '$lib/demo-code-samples'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import ArchiveArmedDemo from '$lib/examples/armed-buttons/demos/Archive.svelte'
    import ArmedButtonsDefault from '$lib/examples/armed-buttons/demos/Default.svelte'
    import DeleteArmedWaitDemo from '$lib/examples/armed-buttons/demos/DeleteWait.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Armed Buttons' }
        ]
    }
    if (seo) {
        seo.title = 'Armed Buttons | Examples | Svelte Motion'
        seo.description =
            'Production-style armed archive and delete wait button microinteractions built with Svelte Motion, AnimatePresence, and spring transitions.'
        seo.ogTitle = 'Armed Buttons'
        seo.ogTagline = 'Destructive action microinteractions built with Svelte Motion'
        seo.ogFeatures = ['AnimatePresence', 'Armed State', 'Countdown Wait', 'Spring Feedback']
        seo.ogSlug = 'examples-armed-buttons'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'ARMED',
            title: { prefix: 'archive ', accent: 'armed button', end: '.' },
            description:
                'A quiet row action that becomes intentional on demand: hover exposes the archive icon, first click arms it, and `AnimatePresence` springs a compact confirm button into place. Arm another row to watch the previous one eject.',
            snippet: archiveSection,
            codeSnippet: archiveCode,
            notes: archiveNotes,
            barCells: [{ k: 'wow', v: 'icon blooms into confirm' }],
            sourceUrl: `${SOURCE_URL}armed-buttons/ArchiveArmedButton.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'WAIT',
            title: { prefix: 'delete armed + ', accent: 'wait', end: '.' },
            description:
                'Each delete row arms on first click, locks itself behind a visible countdown, then swaps into the final destructive confirm state without resizing the control. Arming a different row cancels the first countdown.',
            snippet: deleteSection,
            codeSnippet: deleteCode,
            notes: deleteNotes,
            barCells: [{ k: 'wow', v: 'safety timer without layout shift' }],
            sourceUrl: `${SOURCE_URL}armed-buttons/DeleteArmedWaitButton.svelte`
        },
        {
            figId: 'FIG-003',
            tag: 'VIDEO',
            title: { prefix: 'recording ', accent: 'stage', end: '.' },
            description:
                'A merged shared-insight list for demos, posts, and short design videos: archive and delete live beside each other, with delete hiding archive while it is armed.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'format', v: 'video-ready' }],
            sourceUrl: `${SOURCE_URL}armed-buttons/demos/Default.svelte`
        }
    ]
</script>

{#snippet archiveSection()}
    <ArchiveArmedDemo />
{/snippet}
{#snippet archiveNotes()}
    <ul>
        <li>
            <Archive />
            <span>
                The WOW behavior is the small archive icon blooming into a labeled confirm button,
                keeping the row calm until the user shows intent. Archived rows flip the same slot
                into an armed unarchive action.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                <code>AnimatePresence</code> owns the confirm button mount and exit, while the row
                uses
                <code>whileHover</code> and spring transitions for tactile feedback.
            </span>
        </li>
        <li>
            <TimerReset />
            <span>
                The armed state auto-disarms after a short timeout, so an abandoned destructive
                action never stays primed.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet archiveCode()}
    <CodeReferenceV2
        samples={demoCodeSamples(
            'armed-buttons/demos/Archive.svelte',
            'armed-buttons-archive',
            'Archive.svelte'
        )}
        columns={1}
    />
{/snippet}

{#snippet deleteSection()}
    <DeleteArmedWaitDemo />
{/snippet}
{#snippet deleteNotes()}
    <ul>
        <li>
            <ShieldCheck />
            <span>
                The WOW behavior is the row becoming its own safety mechanism: click once to arm,
                wait for the timer, then click again to confirm. Arming a second row cancels the
                first row's countdown.
            </span>
        </li>
        <li>
            <TimerReset />
            <span>
                A keyed motion span swaps trash, spinner, and success states so each icon gets a
                crisp entrance instead of popping in place.
            </span>
        </li>
        <li>
            <Sparkles />
            <span>
                Fixed height and reserved trailing space keep the button steady while countdown text
                changes.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet deleteCode()}
    <CodeReferenceV2
        samples={demoCodeSamples(
            'armed-buttons/demos/DeleteWait.svelte',
            'armed-buttons-delete-wait',
            'DeleteWait.svelte'
        )}
        columns={1}
    />
{/snippet}

{#snippet defaultSection()}
    <ArmedButtonsDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Sparkles />
            <span>
                The stage keeps the shared-insight row format while combining archive and delete
                into one stable action cluster.
            </span>
        </li>
        <li>
            <Archive />
            <span>
                Archive arms in its own slot and leaves delete visible, so the safer secondary
                action never disappears during archive confirmation.
            </span>
        </li>
        <li>
            <Trash2 />
            <span>
                Delete clears any armed archive state, hides the archive control, counts down, and
                then unlocks the final destructive click.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={demoCodeSamples(
            'armed-buttons/demos/Default.svelte',
            'armed-buttons-default',
            'Default.svelte'
        )}
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
