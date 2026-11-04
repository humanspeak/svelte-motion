<script lang="ts">
    import IsPresentOnlyProbe from '$lib/components/__tests__/IsPresentOnlyProbe.svelte'
    import LegacyPresenceProbe from '$lib/components/__tests__/LegacyPresenceProbe.svelte'
    import PresenceProbe from '$lib/components/__tests__/PresenceProbe.svelte'
    import { setPresenceChildContext, type PresenceChildContext } from '$lib/utils/presence'

    // A hand-built PresenceChild context (plan 017), so a spec can spy on
    // `register` and `markLegacyManual` directly.
    let {
        present,
        register,
        markLegacyManual,
        probe = 'init',
        show = true
    }: {
        present: boolean
        register: (id: string | number) => () => void
        markLegacyManual?: () => boolean
        probe?: 'init' | 'legacy' | 'is-present'
        show?: boolean
    } = $props()

    setPresenceChildContext({
        get isPresent() {
            return present
        },
        safeToRemove: () => {},
        register: (id: string | number) => register(id),
        get onExitComplete() {
            return () => {}
        },
        markLegacyManual: () => markLegacyManual?.() ?? false
    } as unknown as PresenceChildContext)
</script>

{#if show}
    {#if probe === 'legacy'}
        <LegacyPresenceProbe />
    {:else if probe === 'is-present'}
        <IsPresentOnlyProbe />
    {:else}
        <PresenceProbe />
    {/if}
{/if}
