<script lang="ts">
    import {
        CodeReferenceV2,
        ExampleV2,
        type ExampleSection,
        formatSheetLabel
    } from '@humanspeak/docs-kit'
    import { Hand, Heart, Move, Zap } from '@lucide/svelte'
    import { demoCodeSample } from '$lib/demo-loaders'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import PanDefault from '$lib/examples/pan/demos/Default.svelte'
    import PanSwipeCards from '$lib/examples/pan/demos/SwipeCards.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'Pan' }]
    }
    if (seo) {
        seo.title = 'Pan | Examples | Svelte Motion'
        seo.description =
            'A swipe-to-dismiss bottom sheet — the canonical pan-gesture pattern. Pull the sheet down past a threshold or flick fast to dismiss; otherwise it springs back. Velocity-aware release.'
        seo.ogTitle = 'Pan'
        seo.h1 = { title: 'Pan', mode: 'sr-only' }
        seo.ogTagline = 'Swipe to dismiss, flick to confirm'
        seo.ogFeatures = ['Pan', 'Swipe', 'Velocity', 'Sheet']
        seo.ogSlug = 'examples-pan'
    }

    const SOURCE_URL =
        'https://github.com/humanspeak/svelte-motion/blob/main/docs/src/lib/examples/'

    const sections: ExampleSection[] = [
        {
            figId: 'FIG-001',
            tag: 'GESTURE',
            title: { prefix: 'swipe to ', accent: 'decide', end: '.' },
            description:
                'A Tinder-style card stack — drag horizontally, watch the top card translate AND rotate (one source MotionValue drives both via `useTransform`), and a LIKE / NOPE badge fades in on the relevant side. Release past the 140px distance threshold OR with > 650 px/s velocity flings the card off screen and the stack springs forward. Anything weaker snaps back.',
            snippet: swipeSection,
            codeSnippet: swipeCode,
            notes: swipeNotes,
            barCells: [{ k: 'pattern', v: 'swipe-card stack' }],
            sourceUrl: `${SOURCE_URL}pan/demos/SwipeCards.svelte`
        },
        {
            figId: 'FIG-002',
            tag: 'GESTURE',
            title: { prefix: 'flick to ', accent: 'dismiss', end: '.' },
            description:
                'A bottom sheet that follows your finger as you pull it down. Past 120px OR with downward velocity > 700 px/s, it commits to dismiss. Otherwise it springs back. `pan` gives you offset + velocity; you decide what to do with them.',
            snippet: defaultSection,
            codeSnippet: defaultCode,
            notes: defaultNotes,
            barCells: [{ k: 'pattern', v: 'swipe-to-dismiss sheet' }],
            sourceUrl: `${SOURCE_URL}pan/demos/Default.svelte`
        }
    ]
</script>

{#snippet swipeSection()}
    <PanSwipeCards />
{/snippet}
{#snippet swipeNotes()}
    <ul>
        <li>
            <Heart />
            <span>
                One <code>useMotionValue</code> for the top card's horizontal offset, three
                <code>useTransform</code>s on top of it: rotation maps
                <code>[-200, 0, 200]</code> → <code>[-18°, 0°, 18°]</code>, and the LIKE / NOPE
                badge opacities ramp in over the 40–140px gutter. One source, four visuals, can't
                desync.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                The commit gate is <em>distance OR velocity</em>: 140px past origin
                <strong>or</strong> > 650 px/s in either direction fires the fly-off. The direction
                is taken from <code>Math.sign(info.offset.x)</code> with
                <code>info.velocity.x</code> as the fallback for fast flicks with sub-threshold distance.
            </span>
        </li>
        <li>
            <Hand />
            <span>
                The stack uses three card slots with hard-coded depth (Y offset + scale on the back
                ones — no actual 3D). On commit, the top card animates to ±600px via a soft spring,
                then <code>deck = deck.slice(1)</code> drops it and the
                <code>{'{#each}'}</code> block re-keys the remaining cards forward.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet swipeCode()}
    <CodeReferenceV2
        samples={[
            demoCodeSample('pan/demos/SwipeCards.svelte', 'pan-swipe-cards', 'SwipeCards.svelte')
        ]}
        columns={1}
    />
{/snippet}
{#snippet defaultSection()}
    <PanDefault />
{/snippet}
{#snippet defaultNotes()}
    <ul>
        <li>
            <Hand />
            <span>
                <code>onPan</code> fires every frame with <code>info.offset</code> and
                <code>info.velocity</code>. We clamp offset to <code>>= 0</code> so the sheet only follows
                downward drags, and write it straight into a motion value the transform reads.
            </span>
        </li>
        <li>
            <Zap />
            <span>
                The release decision in <code>onPanEnd</code> is the
                <em>distance OR velocity</em> pattern: pulled more than 120px past origin
                <strong>or</strong> still moving downward faster than 700px/s ⇒ dismiss. Either condition
                alone fires the close. This is how a real sheet feels — slow pull works, fast flick also
                works.
            </span>
        </li>
        <li>
            <Move />
            <span>
                The overlay opacity is a <code>useTransform</code> of the same sheet offset — at 0px it's
                fully opaque, at 300px it's transparent. One source value drives both the sheet position
                and the dimmer, so the visuals can't desync.
            </span>
        </li>
    </ul>
{/snippet}
{#snippet defaultCode()}
    <CodeReferenceV2
        samples={[demoCodeSample('pan/demos/Default.svelte', 'pan-default', 'Default.svelte')]}
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
