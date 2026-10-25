<script lang="ts">
    import type { MotionScope } from 'motion-dom'
    import {
        useScopeMotion,
        type MotionScopeAttachment,
        type UseScopeMotionOptions
    } from '../scopeMotion.svelte.js'

    type Props = {
        /** Runs in the scope; receives the probe's internal `$state` counter (read untracked). */
        setup: (scope: MotionScope, tracked: number) => void | VoidFunction
        options?: Omit<UseScopeMotionOptions, 'deps'>
        /** Value the `deps` getter reads, when `useDeps` is set. */
        dep?: number
        useDeps?: boolean
        onScope?: (scope: MotionScopeAttachment<HTMLUListElement>) => void
    }

    const { setup, options = {}, dep = 0, useDeps = false, onScope }: Props = $props()

    let tracked = $state(0)

    /** Changes `$state` that setup reads, to prove setup is untracked. */
    export function bump(): void {
        tracked++
    }

    // svelte-ignore state_referenced_locally
    const scope = useScopeMotion<HTMLUListElement>((s) => setup(s, tracked), {
        ...options,
        ...(useDeps ? { deps: () => dep } : {})
    })
    // svelte-ignore state_referenced_locally
    onScope?.(scope)
</script>

<ul data-testid="root" {@attach scope}>
    <li class="item" data-testid="inside"></li>
</ul>
