<!--
@component
Repro: AnimatePresence exit clones do not freeze the card's computed look.

Every card here is styled ONLY through selectors that depend on where the
card sits in the DOM — no inline visual styles. When a card exits,
`unregisterChild` in `src/lib/utils/presence.ts` clones the (already
detached) element and tries to freeze its look by copying
`child.lastComputedStyle`. That is a LIVE `CSSStyleDeclaration`, which reads
empty once Svelte has detached the element, so nothing is frozen. The clone
is then re-inserted into the nearest non-`display: contents` ancestor (here
`.cards` / `.solo`, one level above AnimatePresence's container), and its
look is whatever the page's selectors match at that new spot:

- Card B (`.cards .card`, a plain descendant rule) still matches: control.
- Card A (`.cards .card:first-child`) is no longer a first child: it
  flips from the blue "featured" look to the plain tomato look mid-fade.
- The solo card (`.solo .card:first-child` holds its whole look) is no
  longer a first child either: it fades out unstyled.
-->
<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const initialCards = () => [
        { id: 'a', label: 'Card A · featured' },
        { id: 'b', label: 'Card B' },
        { id: 'c', label: 'Card C' }
    ]

    let cards = $state(initialCards())
    let soloVisible = $state(true)

    const remove = (id: string) => {
        cards = cards.filter((card) => card.id !== id)
    }

    const reset = () => {
        cards = initialCards()
        soloVisible = true
    }

    type Look = { background: string; radius: string; color: string }

    const readLook = (element: Element): Look => {
        const style = getComputedStyle(element)
        return {
            background: style.backgroundColor,
            radius: style.borderTopLeftRadius,
            color: style.color
        }
    }

    const sameLook = (a: Look, b: Look) =>
        a.background === b.background && a.radius === b.radius && a.color === b.color

    type Exit = {
        card: string
        expected: Look | null
        current: Look
        opacity: string
        frames: number
        lostAt: Look | null
    }

    // Read-only live readout. Every frame: remember each live card's look,
    // then compare any exit clone (`[data-clone="true"]`, which keeps the
    // card's data-testid) against the look its card had while connected.
    // Nothing here writes to the fixture DOM.
    let exit = $state<Exit | null>(null)
    let exiting = $state(false)

    onMount(() => {
        const liveLooks = {} as Record<string, Look>
        let frame = 0

        const tick = () => {
            for (const card of document.querySelectorAll('[data-card]:not([data-clone])')) {
                liveLooks[card.getAttribute('data-testid') ?? ''] = readLook(card)
            }
            const clone = document.querySelector<HTMLElement>('[data-clone="true"][data-card]')
            if (clone) {
                const card = clone.getAttribute('data-testid') ?? ''
                const current = readLook(clone)
                const opacity = Number(getComputedStyle(clone).opacity).toFixed(2)
                if (!exiting || exit?.card !== card) {
                    exit = {
                        card,
                        expected: liveLooks[card] ?? null,
                        current,
                        opacity,
                        frames: 0,
                        lostAt: null
                    }
                    exiting = true
                }
                const active = exit!
                active.frames += 1
                active.current = current
                active.opacity = opacity
                if (!active.lostAt && active.expected && !sameLook(current, active.expected)) {
                    active.lostAt = current
                }
            } else {
                exiting = false
            }
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    })

    const click = (testId: string) =>
        document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.click()

    const steps: TesterStep[] = [
        {
            text: 'Remove Card A (the blue "featured" first card).',
            expected:
                'Card A fades out over 1.5 s and stays blue with 24px corners the whole time. It never flips to tomato.',
            action: { label: 'Remove Card A', run: () => click('remove-a') }
        },
        {
            text: 'Remove Card B (control: plain descendant selector).',
            expected: 'Card B fades out and stays tomato with 12px corners and white bold text.',
            action: { label: 'Remove Card B', run: () => click('remove-b') }
        },
        {
            text: 'Hide the solo card (the {#if} variant).',
            expected:
                'The solo card fades out over 1.5 s and keeps its tomato background, rounded corners and white bold text until it is gone.',
            action: { label: 'Hide solo card', run: () => click('toggle-solo') }
        },
        {
            text: 'Watch the live readout during each exit.',
            expected:
                'The clone look matches the card look captured before the exit, and the chip reads KEPT STYLE.'
        },
        {
            text: 'Put everything back.',
            expected: 'All three list cards and the solo card are visible again.',
            action: { label: 'Reset', run: () => click('reset') }
        }
    ]
</script>

<svelte:head>
    <title>AnimatePresence clone keeps parent-dependent styles</title>
</svelte:head>

<main>
    <h1>Exit clone keeps parent-dependent styles</h1>
    <p class="intro">
        Cards are styled only through ancestor and structural selectors, never inline. A fading card
        must look exactly like it did before it was removed.
    </p>

    <div class="controls">
        <button data-testid="reset" onclick={reset}>Reset</button>
    </div>

    <h2>Keyed <code>{'{#each}'}</code></h2>
    <div class="cards" data-testid="cards">
        <AnimatePresence>
            {#each cards as card (card.id)}
                <motion.div
                    key={card.id}
                    class="card"
                    data-card
                    data-testid={`card-${card.id}`}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                >
                    <span>{card.label}</span>
                    <button data-testid={`remove-${card.id}`} onclick={() => remove(card.id)}>
                        Remove
                    </button>
                </motion.div>
            {/each}
        </AnimatePresence>
    </div>

    <h2><code>{'{#if}'}</code></h2>
    <div class="controls">
        <button data-testid="toggle-solo" onclick={() => (soloVisible = !soloVisible)}>
            {soloVisible ? 'Hide' : 'Show'} solo card
        </button>
    </div>
    <div class="solo" data-testid="solo">
        <AnimatePresence>
            {#if soloVisible}
                <motion.div
                    key="solo"
                    class="card"
                    data-card
                    data-testid="card-solo"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5 }}
                >
                    <span>Solo card</span>
                </motion.div>
            {/if}
        </AnimatePresence>
    </div>
</main>

<TesterPanel
    eyebrow="AnimatePresence · exit clone"
    title="Fading card keeps its look"
    status="Passes on this build."
    {steps}
>
    {#snippet checks()}
        <p>
            Every card is styled only by selectors in this page's <code>&lt;style&gt;</code> block
            that depend on where the card sits (<code>.cards .card</code>,
            <code>.card:first-child</code>) — no inline visual styles.
        </p>
        <p>
            The fading card must keep its look (tomato or featured-blue background, rounded corners,
            white bold text) for the whole 1.5 s fade, in both the keyed
            <code>{'{#each}'}</code> list and the <code>{'{#if}'}</code> variant.
        </p>
    {/snippet}

    {#if exit}
        {@const lost = Boolean(exit.lostAt)}
        <p class="chip" class:lost>{lost ? 'LOST STYLE' : 'KEPT STYLE'}</p>
        <dl class="readout">
            <dt>Exit clone</dt>
            <dd>{exit.card} · {exiting ? `opacity ${exit.opacity}` : 'done'}</dd>
            <dt>before exit</dt>
            <dd>
                {exit.expected ? `${exit.expected.background} · ${exit.expected.radius}` : '—'}
            </dd>
            <dt>clone now</dt>
            <dd>{exit.current.background} · {exit.current.radius}</dd>
            <dt>frames</dt>
            <dd>{exit.frames}</dd>
        </dl>
        {#if exit.lostAt}
            <p class="note">
                First bad frame: {exit.lostAt.background} · {exit.lostAt.radius} · text {exit.lostAt
                    .color}
            </p>
        {/if}
    {:else}
        <p class="note">No exit yet. Remove a card to sample its exit clone every frame.</p>
    {/if}
</TesterPanel>

<style>
    main {
        padding: 2rem 400px 4rem 2rem;
        font-family: system-ui, sans-serif;
    }

    .intro {
        max-width: 560px;
        color: #555;
    }

    .controls {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
    }

    .cards,
    .solo {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        min-height: 72px;
    }

    /* Parent-dependent styling only: these rules are the cards' whole look. */
    .cards :global(.card),
    .solo :global(.card:first-child) {
        display: flex;
        align-items: center;
        gap: 12px;
        background: tomato;
        color: white;
        border-radius: 12px;
        padding: 16px;
        font: 600 18px system-ui;
    }

    .cards :global(.card:first-child) {
        background: #2b59c3;
        border-radius: 24px;
    }

    /*
     * Never matches a live card: AnimatePresence's `display: contents`
     * container sits between `.cards` and every card. An exit clone must not
     * pick it up either (lime ring, wide letter-spacing).
     */
    .cards > :global(.card) {
        box-shadow: 0 0 0 4px lime;
        letter-spacing: 4px;
    }

    .readout {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2px 12px;
        margin: 0 0 8px;
        font:
            12px ui-monospace,
            monospace;
    }

    .readout dt {
        color: #5c6b80;
    }

    .readout dd {
        margin: 0;
    }

    .chip {
        display: inline-block;
        margin: 0 0 8px;
        padding: 2px 10px;
        border-radius: 999px;
        background: #d9f4e3;
        color: #146c3a;
        font: 700 11px system-ui;
        letter-spacing: 0.06em;
    }

    .chip.lost {
        background: #fde2e2;
        color: #a11d1d;
    }

    .note {
        margin: 0;
        font-size: 12px;
        color: #43536a;
    }
</style>
