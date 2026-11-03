<script lang="ts" module>
    // Module-scoped sinks: how many times the child was created, and the
    // first element it rendered, so a test can tell a kept child from a
    // destroyed-and-re-created one.
    let mounts = 0
    export const getMountFlipMounts = (): number => mounts
    export const resetMountFlipMounts = (): void => {
        mounts = 0
    }
</script>

<script lang="ts">
    import PresenceChild from '$lib/components/PresenceChild.svelte'
    import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
    import { onMount } from 'svelte'

    // Plan 012 A5: the page's own `onMount` flips `present` in the same
    // flush as the mount, as `tests/layout-id/exit-complete-once` does for
    // its first box. The flip reaches `PresenceChild` before its phase
    // effect has moved the phase to `holding`.
    let { flipOnMount = true }: { flipOnMount?: boolean } = $props()
    let present = $state(true)
    onMount(() => {
        if (flipOnMount) present = false
    })

    const counted = (node: HTMLElement) => {
        mounts += 1
        node.dataset.mount = String(mounts)
    }
</script>

<PresenceChild {present}>
    <div data-testid="flip-child" {@attach counted}>
        <PresenceProbe />
    </div>
</PresenceChild>
