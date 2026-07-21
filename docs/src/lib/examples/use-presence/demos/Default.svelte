<script lang="ts">
    import { AnimatePresence, PresenceChild, motion, styleString } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'
    import UsePresenceCard from './UsePresenceCard.svelte'

    // Custom exit driven from the child: `<PresenceChild present={…}>` holds the
    // card rendered after `present` flips to `false`. Inside the card, `usePresence`
    // returns `[false, safeToRemove]` once the hold begins — the card runs its own
    // CSS transition and calls `safeToRemove()` on `transitionend` so the wrapper
    // releases it.
    let visible = $state(true)
    let exitsCompleted = $state(0)

    // Defer the AnimatePresence subtree until after hydration — SSR doesn't have a
    // window to register presence children against.
    let mounted = $state(false)
    onMount(() => (mounted = true))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-presence</span>
            <span class="micro state">
                exits: {String(exitsCompleted).padStart(2, '0')}
            </span>
        </div>

        <div class="stage">
            {#if mounted}
                <AnimatePresence onExitComplete={() => exitsCompleted++}>
                    <PresenceChild present={visible}>
                        <UsePresenceCard />
                    </PresenceChild>
                </AnimatePresence>
            {/if}
        </div>

        <div class="strip-foot">
            <motion.button
                type="button"
                onclick={() => (visible = !visible)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={styleString(() => ({
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    padding: '0.5rem 0.875rem',
                    cursor: 'pointer'
                }))}
            >
                {visible ? '– hide card' : '+ show card'}
            </motion.button>
            <span class="micro">exit: css transition → safeToRemove()</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 360px;
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
        font-variant-numeric: tabular-nums;
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
        height: 8rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
