<script lang="ts">
    import { styleString } from '@humanspeak/svelte-motion'
    import Badge from '../Badge.svelte'
    import { getNextState, styles, type BadgeState } from '../constants'

    // Badge that cycles idle → processing → success → error → idle.
    // Each state swaps an icon and a label inside `AnimatePresence` —
    // exits and enters share a layout so the chrome stays put while
    // the contents fly through with blur + scale.
    // Ported from: https://examples.motion.dev/react/multi-state-badge

    let badgeState = $state<BadgeState>('idle')
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div style={styleString(() => styles.container)}>
        <button
            onclick={() => {
                badgeState = getNextState(badgeState)
            }}
            style="background: none; border: none; cursor: pointer; padding: 0;"
        >
            <Badge state={badgeState} />
        </button>
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 280px;
    }
</style>
