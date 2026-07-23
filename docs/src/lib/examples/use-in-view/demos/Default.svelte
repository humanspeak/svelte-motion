<script lang="ts">
    import { useInView } from '@humanspeak/svelte-motion'

    // `useInView(getter, options)` watches the resolved element with an
    // IntersectionObserver and exposes a reactive boolean. `once: true`
    // latches to `true` the first time it sees the element and never
    // flips back — perfect for one-shot enter animations.
    let scrollContainer: HTMLDivElement | undefined = $state()
    let topEl: HTMLDivElement | undefined = $state()
    let bottomEl: HTMLDivElement | undefined = $state()

    const topInView = useInView(() => topEl, { root: () => scrollContainer })
    const bottomInView = useInView(() => bottomEl, {
        root: () => scrollContainer,
        once: true
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-in-view</span>
            <span class="micro state">
                top: {topInView.current ? 'visible' : 'hidden'}
            </span>
        </div>

        <div bind:this={scrollContainer} class="frame">
            <div bind:this={topEl} class="card" data-in-view={topInView.current}>
                <span class="card-label">// live observer</span>
                <span class="card-value">
                    top: <strong>{topInView.current ? 'visible' : 'hidden'}</strong>
                </span>
            </div>
            <div class="filler">↓ scroll ↓</div>
            <div bind:this={bottomEl} class="card" data-in-view={bottomInView.current}>
                <span class="card-label">// once: true</span>
                <span class="card-value">
                    bottom: <strong>{bottomInView.current ? 'latched' : 'pending'}</strong>
                </span>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">observer: intersection</span>
            <span class="micro state">
                latch: {bottomInView.current ? 'latched' : 'pending'}
            </span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 420px;
    }

    .strip {
        width: 100%;
        max-width: 360px;
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

    .frame {
        width: 100%;
        height: 260px;
        overflow: auto;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .card {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 1rem 1.125rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .card-label {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .card-value {
        font-family: var(--brut-mono, monospace);
        font-size: 0.8125rem;
        color: var(--brut-ink-2, #525252);
    }

    .card-value strong {
        color: var(--brut-accent, #247768);
    }

    .filler {
        flex-shrink: 0;
        height: 360px;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }
</style>
