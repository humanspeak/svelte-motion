<script lang="ts">
    import { ArrowLeftRight, Sparkles } from '@lucide/svelte'
    import { motion, useWillChange } from '@humanspeak/svelte-motion'

    const willChange = useWillChange()
    let started = $state(false)
    let moved = $state(false)

    // No transform key until the first interaction, so will-change starts at
    // "auto". After that, toggle x both ways. will-change latches to "transform"
    // on the first animation and stays there (upstream useWillChange is one-way).
    const target = $derived(started ? { x: moved ? 220 : 0 } : {})

    const toggle = () => {
        started = true
        moved = !moved
    }
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="toolbar">
        <button type="button" class="primary" onclick={toggle}>
            {#if moved}
                <ArrowLeftRight size={15} />
                Return
            {:else}
                <Sparkles size={15} />
                Animate x
            {/if}
        </button>
        <span class="value">will-change: <strong>{willChange.current}</strong></span>
    </div>

    <div class="stage">
        <div class="track">
            <motion.div
                class="card"
                style={{ willChange }}
                initial={false}
                animate={target}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                <small>style.willChange</small>
                <strong>{willChange.current}</strong>
            </motion.div>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        height: clamp(420px, calc(100vh - 160px), 520px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 16px;
        padding: 20px 26px;
        background: #0d1518;
        color: #eef6fb;
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
    }

    button {
        height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 0 12px;
        border: 1px solid #46616a;
        border-radius: 6px;
        background: #142127;
        color: #eef6fb;
        font-size: 13px;
        font-weight: 780;
        cursor: pointer;
    }

    button.primary {
        border-color: #5eead4;
        background: #0f766e;
    }

    .value {
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 13px;
        color: #a9c9cf;
    }

    .value strong {
        color: #5eead4;
    }

    .stage {
        position: relative;
        overflow: hidden;
        border: 1px solid #2b4650;
        background:
            linear-gradient(90deg, rgba(94, 234, 212, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(94, 234, 212, 0.1) 1px, transparent 1px), #071114;
        background-size: 44px 44px;
    }

    .track {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        padding: 0 32px;
    }

    :global(.card) {
        width: 150px;
        min-height: 90px;
        display: grid;
        align-content: center;
        gap: 6px;
        padding: 0 18px;
        border-radius: 14px;
        background: linear-gradient(135deg, #67e8f9, #2dd4bf);
        color: #031316;
        box-shadow: 0 22px 80px rgba(45, 212, 191, 0.34);
    }

    :global(.card small) {
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    :global(.card strong) {
        font-size: 20px;
        font-family: 'SFMono-Regular', Consolas, monospace;
    }
</style>
