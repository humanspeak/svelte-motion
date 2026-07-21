<!--
@component
Repro for a sibling "double jump" when a card exits from a CSS grid.

Mirrors the consumer setup: a fixed 3-column grid where each card has
`layout` + enter/exit animations. Removing a card should leave the
exiting card's slot held until its exit finishes, then FLIP the
remaining cards into their new slots — never snap-then-jump-back.
-->
<script lang="ts">
    import { AnimatePresence, MotionDiv } from '$lib/index.js'

    const initialCards = () => [
        { id: 'a', label: 'Card A' },
        { id: 'b', label: 'Card B' },
        { id: 'c', label: 'Card C' }
    ]

    let cards = $state(initialCards())

    const removeAt = (index: number) => {
        cards = cards.filter((_, i) => i !== index)
    }

    const reset = () => {
        cards = initialCards()
    }
</script>

<main style="padding: 2rem; max-width: 1200px;">
    <h1>AnimatePresence grid exit</h1>
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <button data-testid="remove-first" onclick={() => removeAt(0)}>Remove first</button>
        <button data-testid="remove-middle" onclick={() => removeAt(1)}>Remove middle</button>
        <button data-testid="remove-last" onclick={() => removeAt(cards.length - 1)}>
            Remove last
        </button>
        <button data-testid="reset" onclick={reset}>Reset</button>
    </div>

    <div style="position: relative; height: 7rem;">
        <div
            data-testid="grid"
            style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; height: 100%;"
        >
            <AnimatePresence>
                {#each cards as card (card.id)}
                    <MotionDiv
                        key={card.id}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -12, scale: 0.97 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        data-testid={`card-${card.id}`}
                        style="display: flex; height: 100%; flex-direction: column; justify-content: space-between; border: 1px solid #444; border-radius: 0.75rem; padding: 1rem; background: #1a1a1e; color: #eee;"
                    >
                        <strong>{card.label}</strong>
                        <span>content</span>
                    </MotionDiv>
                {/each}
            </AnimatePresence>
        </div>
    </div>
</main>
