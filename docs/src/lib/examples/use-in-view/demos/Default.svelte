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
    <p class="text-sm text-muted-foreground">Scroll the panel below.</p>
    <div bind:this={scrollContainer} class="frame">
        <div bind:this={topEl} class="card top" data-in-view={$topInView}>
            top: <strong>{$topInView ? 'visible' : 'hidden'}</strong>
        </div>
        <div class="filler">↓ scroll ↓</div>
        <div bind:this={bottomEl} class="card bottom" data-in-view={$bottomInView}>
            bottom (once): <strong>{$bottomInView ? 'latched' : 'pending'}</strong>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 2rem;
        min-height: 420px;
    }

    .frame {
        width: 320px;
        height: 280px;
        overflow: auto;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .card {
        flex-shrink: 0;
        padding: 18px 20px;
        border-radius: 10px;
        font-size: 14px;
        color: white;
        transition:
            background-color 200ms ease,
            box-shadow 200ms ease;
    }

    .top {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .bottom {
        background: linear-gradient(135deg, #db2777 0%, #f59e0b 100%);
    }

    .filler {
        flex-shrink: 0;
        height: 360px;
        border-radius: 8px;
        border: 1px dashed rgba(255, 255, 255, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
    }
</style>
