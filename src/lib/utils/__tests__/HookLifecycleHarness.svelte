<script lang="ts">
    import type { Readable } from 'svelte/store'
    import { useMotionValue } from '../motionValue.svelte.js'
    import { useTransform } from '../transform.svelte.js'
    import type { AugmentedMotionValue } from '../augmentMotionValue.svelte.js'

    // Exposes hook-created values to the spec so it can assert on their
    // behavior before AND after the component unmounts.
    let {
        source,
        onvalues
    }: {
        source?: Readable<number>
        onvalues: (values: {
            x: AugmentedMotionValue<number>
            doubled: AugmentedMotionValue<number>
            mapped?: AugmentedMotionValue<number>
            outputMap?: { a: AugmentedMotionValue<number>; b: AugmentedMotionValue<number> }
        }) => void
    } = $props()

    const x = useMotionValue(1)
    const doubled = useTransform(() => x.get() * 2)
    // The harness deliberately captures the initial `source` prop; hooks
    // are init-time constructs.
    // svelte-ignore state_referenced_locally
    const mapped = source ? useTransform(source, [0, 10], [0, 100]) : undefined
    // svelte-ignore state_referenced_locally
    const outputMap = source
        ? useTransform(source, [0, 10], { a: [0, 100], b: [100, 0] })
        : undefined

    // svelte-ignore state_referenced_locally
    onvalues({ x, doubled, mapped, outputMap })
</script>

<span data-testid="hook-harness">{x.current}</span>
