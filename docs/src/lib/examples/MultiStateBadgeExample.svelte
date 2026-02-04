<!--
  @component
  A multi-state badge that cycles through idle, processing, success, and error states.
  Demonstrates AnimatePresence, useTime, useTransform, SVG pathLength animations,
  and imperative animate() calls for shake/scale effects.

  Ported from: https://examples.motion.dev/react/multi-state-badge
-->
<script lang="ts">
    import { styleString } from '@humanspeak/svelte-motion'
    import Badge from './multi-state-badge/Badge.svelte'
    import { getNextState, type BadgeState } from './multi-state-badge/constants'

    let badgeState = $state<BadgeState>('idle')
</script>

<div
    style={styleString(() => ({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        height: 80
    }))}
>
    <button
        onclick={() => {
            badgeState = getNextState(badgeState)
        }}
        style="background: none; border: none; cursor: pointer; padding: 0;"
    >
        <Badge state={badgeState} />
    </button>
</div>
