<script lang="ts">
    import { styleString } from '@humanspeak/svelte-motion'
    import Badge from '../Badge.svelte'
    import { getNextState, styles, type BadgeState } from '../constants'

    // Badge that cycles idle → processing → success → error → idle.
    // Each state swaps an icon and a label inside `AnimatePresence` —
    // exits and enters share a layout so the chrome stays put while
    // the contents fly through with blur + scale.
    // Ported from: https://examples.motion.dev/react/multi-state-badge
    //
    // The badge component (its #f5f5f5 pill, 999 radius, AnimatePresence
    // modes) is intentionally unchanged — only the surrounding docs shell
    // wears the brutalist strip chrome.

    let badgeState = $state<BadgeState>('idle')
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// multi-state badge</span>
            <span class="micro state">state: {badgeState}</span>
        </div>

        <div class="stage">
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

        <div class="strip-foot">
            <span class="micro">click badge to advance</span>
            <span class="micro">4 states / animate-presence</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 280px;
    }

    .strip {
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .state {
        color: var(--brut-accent, #247768);
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }
</style>
