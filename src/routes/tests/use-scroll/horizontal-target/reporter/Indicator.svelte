<script lang="ts">
    import { motion, useScroll } from '$lib'

    type Props = {
        /** Getter for the shared horizontal scroll container. */
        container: () => HTMLElement | undefined
        /** Item index, used for the indicator's id / test id. */
        index: number
        /** Optional explicit axis (`?axis=x`). */
        axis?: 'x'
    }

    let { container, index, axis }: Props = $props()

    let el = $state<HTMLElement>()

    // Equivalent to ['end end', 'start start'] for a 70vw target in a 100vw
    // container; the vw unit keeps it off the native ViewTimeline so the JS
    // `scroll()` path (#2546) is under test.
    // svelte-ignore state_referenced_locally
    const { scrollXProgress } = useScroll({
        target: () => el,
        container,
        offset: ['70vw 100vw', '0px 0px'],
        ...(axis ? { axis } : {})
    })
</script>

<section style="width: 70vw; flex-shrink: 0;">
    <div bind:this={el}>
        <svg width="75" height="75" viewBox="0 0 100 100">
            <motion.circle
                id="indicator-{index}"
                data-testid="indicator-{index}"
                cx="50"
                cy="50"
                r="30"
                pathLength="1"
                fill="none"
                stroke="red"
                stroke-width="10"
                style={{ pathLength: scrollXProgress }}
            />
        </svg>
    </div>
</section>
