<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
    import CardItem from './CardItem.svelte'

    type Card = {
        id: number
        name: string
        line: string
        emoji: string
        from: string
        to: string
    }

    const SEED: Card[] = [
        {
            id: 0,
            name: 'Ada',
            line: 'designs algorithms in her sleep',
            emoji: '🧮',
            from: '#a78bfa',
            to: '#7c3aed'
        },
        {
            id: 1,
            name: 'Grace',
            line: 'wrote the manual you read',
            emoji: '🐛',
            from: '#f472b6',
            to: '#db2777'
        },
        {
            id: 2,
            name: 'Linus',
            line: 'built it on a coffee break',
            emoji: '🐧',
            from: '#22d3ee',
            to: '#0891b2'
        },
        {
            id: 3,
            name: 'Margaret',
            line: 'shipped to the moon',
            emoji: '🚀',
            from: '#fb923c',
            to: '#ea580c'
        },
        {
            id: 4,
            name: 'Alan',
            line: 'asked the machine what it wanted',
            emoji: '🤖',
            from: '#34d399',
            to: '#059669'
        }
    ]

    let deck: Card[] = $state([...SEED])

    // Each CardItem owns its own pan MotionValue + commit animation,
    // so the parent's job here is purely "remove the top card once the
    // child has finished flinging itself off-screen". No shared MV to
    // reset → no one-frame flash of the outgoing card snapping back to
    // centre while the unmount is queued.
    const onCommit = () => {
        deck = deck.slice(1)
    }

    const reset = () => {
        deck = [...SEED]
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// swipe-deck</span>
            <span class="micro status">
                {String(deck.length).padStart(2, '0')} / {String(SEED.length).padStart(2, '0')} left
            </span>
        </div>

        <div class="stage">
            {#if deck.length === 0}
                <motion.button
                    type="button"
                    onclick={reset}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={styleString(() => ({
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontFamily: 'var(--brut-mono, monospace)',
                        fontSize: '0.6875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        border: '1px solid var(--brut-accent, #247768)',
                        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                        color: 'var(--brut-accent, #247768)',
                        padding: '0.5rem 0.875rem',
                        cursor: 'pointer'
                    }))}
                >
                    ↺ shuffle the deck
                </motion.button>
            {:else}
                <!-- Render the top 3 cards. Back cards get a subtle Y offset + scale
                     to fake depth without using any actual 3D transforms.
                     Each CardItem owns its own pan MotionValue + LIKE/NOPE
                     derived opacities + commit animation (see CardItem.svelte).
                     The parent only knows about the deck array; cards signal
                     "I'm done flying off, drop me" via the onCommit prop. -->
                {#each deck.slice(0, 3) as card, i (card.id)}
                    <CardItem
                        {card}
                        isTop={i === 0}
                        depthY={i === 0 ? 0 : i * 16}
                        depthRotate={i === 0 ? 0 : i === 1 ? -3 : 4}
                        depthScale={1 - i * 0.03}
                        zIndex={3 - i}
                        {onCommit}
                    />
                {/each}
            {/if}
        </div>

        <div class="strip-foot">
            <span class="micro">← nope</span>
            <span class="micro">like →</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        width: 100%;
    }

    .strip {
        width: 100%;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .status {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        position: relative;
        width: 100%;
        height: 460px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
        background-size:
            36px 36px,
            36px 36px,
            auto;
        overflow: hidden;
    }
</style>
