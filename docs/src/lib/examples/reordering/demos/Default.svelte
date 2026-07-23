<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    // Four coloured tiles shuffle their order every second. Each tile
    // is `layout` — FLIP measures the rect before + after the shuffle,
    // so motion plays the spring-tween between positions.

    const initialOrder = ['#ff0088', '#dd00ee', '#9911ff', '#0d63f8']

    let order = $state([...initialOrder])
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    onMount(() => {
        const scheduleNextShuffle = () => {
            timeoutId = setTimeout(() => {
                order = shuffle(order)
                scheduleNextShuffle()
            }, 1000)
        }

        scheduleNextShuffle()

        return () => {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId)
            }
        }
    })

    function shuffle(array: string[]) {
        return [...array].sort(() => Math.random() - 0.5)
    }

    const spring = {
        type: 'spring' as const,
        damping: 20,
        stiffness: 300
    }

    const container = {
        listStyle: 'none',
        padding: 0,
        margin: 0,
        position: 'relative',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        width: 210,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    }

    const item = {
        width: 100,
        height: 100,
        border: '1px solid var(--brut-ink, #0a0a0a)'
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// reordering</span>
            <span class="micro readout">layout: flip</span>
        </div>

        <div class="stage">
            <motion.ul style={styleString(() => container)}>
                {#each order as backgroundColor (backgroundColor)}
                    <motion.li
                        layout
                        transition={spring}
                        style={styleString(() => ({
                            ...item,
                            backgroundColor
                        }))}
                    />
                {/each}
            </motion.ul>
        </div>

        <div class="strip-foot">
            <span class="micro">4 tiles shuffle every 1s</span>
            <span class="micro">spring: 300 / 20</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 320px;
    }

    .strip {
        width: 100%;
        max-width: 340px;
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

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
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
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }
</style>
