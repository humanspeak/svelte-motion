<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

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

    /**
     * Shuffle an array randomly
     */
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
