<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import type { AnimatePresenceMode } from '$lib/types'
    import { resolve } from '$app/paths'
    import { tick } from 'svelte'
    import './demo.css'

    let mounted = $state(true)
    let visible = $state(true)
    let mode = $state<AnimatePresenceMode>('sync')
    let completed = $state(0)
    const status = $derived(
        !mounted
            ? 'Boundary removed'
            : visible
              ? 'Card is present'
              : completed
                ? 'Exit complete'
                : 'Exit in progress'
    )

    async function resetDemo() {
        mounted = false
        await tick()
        visible = true
        completed = 0
        mounted = true
    }
</script>

<svelte:head>
    <title>AnimatePresence boundary teardown</title>
</svelte:head>

<main class="teardown-lab">
    <header class="lab-header">
        <a class="back-link" href={resolve('/')}>← All demos</a>
        <p class="eyebrow">Exit lab / boundary teardown</p>
        <h1>AnimatePresence boundary teardown</h1>
        <p class="lede">Let a card say goodbye. Let the whole page leave immediately.</p>
        <p class="explanation">
            A card can fade out while its page stays open. Leaving the page should clear that card
            immediately—even if its fade has already started.
        </p>
    </header>

    <div class="lab-grid">
        <section class="demo-panel" aria-label="Interactive exit demo">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">Live demo</p>
                    <h2>A card inside a boundary</h2>
                </div>
                <span class="status" aria-live="polite">{status}</span>
            </div>
            <div class="demo-stage">
                <div class="boundary-outline" class:removed={!mounted}>
                    <span class="boundary-label"
                        >{mounted ? 'AnimatePresence boundary' : 'Boundary removed'}</span
                    >
                    {#if mounted}
                        {#key mode}
                            <AnimatePresence
                                {mode}
                                initial={false}
                                onExitComplete={() => completed++}
                            >
                                {#if visible}
                                    <motion.div
                                        key="card"
                                        data-testid="teardown-card"
                                        class="teardown-card"
                                        exit={{ opacity: 0, x: 100 }}
                                        transition={{ duration: 2, ease: 'linear' }}
                                    >
                                        <span class="card-icon" aria-hidden="true">✦</span>
                                        <strong>A little goodbye.</strong>
                                        <p>This card takes two seconds to fade and slide away.</p>
                                    </motion.div>
                                {/if}
                            </AnimatePresence>
                        {/key}
                    {/if}
                    {#if !mounted || (!visible && completed > 0)}
                        <div class="empty-stage">
                            <span aria-hidden="true">✓</span>
                            <strong
                                >{mounted
                                    ? 'The card finished its exit.'
                                    : 'Everything cleared immediately.'}</strong
                            >
                            <p>
                                {mounted
                                    ? 'The boundary is still here.'
                                    : 'No departing card stays behind.'}
                            </p>
                        </div>
                    {/if}
                </div>
            </div>
            <div class="demo-controls">
                <button
                    class="primary"
                    disabled={!mounted || !visible}
                    onclick={() => (visible = false)}>Hide card</button
                >
                <button disabled={!mounted} onclick={() => (mounted = false)}
                    >Remove boundary</button
                >
                <button class="subtle" onclick={resetDemo}>Reset demo</button>
            </div>
            <div class="demo-readout">
                <label
                    >Presence mode
                    <select bind:value={mode} onchange={resetDemo}>
                        <option value="sync">sync</option><option value="wait">wait</option><option
                            value="popLayout">popLayout</option
                        >
                    </select>
                </label>
                <p>Completed exits: <output data-testid="completed-exits">{completed}</output></p>
            </div>
            <p class="mode-note">All three modes clear immediately when the boundary is removed.</p>
        </section>

        <aside class="guide-panel" aria-label="What to try">
            <p class="eyebrow">What to try</p>
            <ol class="steps">
                <li>
                    <span class="step-number">01</span>
                    <div>
                        <h2>Hide just the card</h2>
                        <p>
                            Press <strong>Hide card</strong>. Watch the full two-second exit. The
                            completed-exit count becomes 1.
                        </p>
                    </div>
                </li>
                <li>
                    <span class="step-number">02</span>
                    <div>
                        <h2>Remove its boundary</h2>
                        <p>
                            Reset, hide the card, then press <strong>Remove boundary</strong> during its
                            fade. It clears immediately. The count stays 0.
                        </p>
                    </div>
                </li>
                <li>
                    <span class="step-number">03</span>
                    <div>
                        <h2>Leave this page</h2>
                        <p>
                            Reset, then navigate away while the card is present or fading. The next
                            page should appear with no leftover card over it.
                        </p>
                    </div>
                </li>
            </ol>
            <a
                class="navigation-button"
                href={resolve('/tests/animate-presence/boundary-teardown/destination')}
                >Navigate away <span aria-hidden="true">↗</span></a
            >
            <p class="guide-note">
                The destination has a contrasting background so any leftover card is easy to spot.
            </p>
        </aside>
    </div>
    <footer class="lab-footer">
        <span class="eyebrow">Expected behavior</span>
        <p>Child leaves → finish its animation. Boundary leaves → clear its exits immediately.</p>
    </footer>
</main>
