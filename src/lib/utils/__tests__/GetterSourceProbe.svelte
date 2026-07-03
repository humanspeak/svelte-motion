<script lang="ts">
    import { useSpring } from '../spring.svelte.js'
    import { useTransform } from '../transform.svelte.js'

    // Rune GETTER sources — $state reads inside the getters are tracked
    // through resolveMotionValueSource for both hooks.
    let source = $state(0)

    export const mapped = useTransform(() => source, [0, 10], [0, 100])
    export const smooth = useSpring(() => source, { stiffness: 1000, damping: 100 })

    export function setSource(next: number): void {
        source = next
    }
</script>

<span data-testid="getter-probe">{mapped.current}</span>
