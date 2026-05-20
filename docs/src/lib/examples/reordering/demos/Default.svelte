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
        width: 300,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    }

    const item = {
        width: 100,
        height: 100,
        borderRadius: '10px'
    }
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
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

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 320px;
    }
</style>
