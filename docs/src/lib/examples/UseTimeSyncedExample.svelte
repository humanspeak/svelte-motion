<script lang="ts">
    import { useTime } from '@humanspeak/svelte-motion'
    import { derived } from 'svelte/store'

    // All elements use the same shared timeline
    const time = useTime('synced-timeline')
    const time2 = useTime('synced-timeline')

    // Create different animations from the same timeline
    const rotate1 = derived(time, (t) => (t / 10) % 360)
    const rotate2 = derived(time2, (t) => (t / 10) % 360)

    const scale1 = derived(time, (t) => 1 + Math.sin(t / 800) * 0.2)
    const scale2 = derived(time2, (t) => 1 + Math.sin(t / 800) * 0.2)

    const hue = derived(time, (t) => (t / 30) % 360)
</script>

<div class="flex min-h-[450px] flex-col items-center justify-center gap-12 p-8">
    <!-- Three synchronized elements -->
    <div class="synced-container">
        <!-- Element 1 -->
        <div class="element-wrapper">
            <div
                class="sync-element element-1"
                style="
                    transform: rotate({$rotate1}deg) scale({$scale1});
                    background: linear-gradient(135deg, hsl({$hue}, 70%, 60%), hsl({$hue +
                    30}, 70%, 50%));
                "
            >
                <span class="element-label">A</span>
            </div>
        </div>

        <!-- Element 2 -->
        <div class="element-wrapper">
            <div
                class="sync-element element-2"
                style="
                    transform: rotate({$rotate2}deg) scale({$scale2});
                    background: linear-gradient(135deg, hsl({$hue + 120}, 70%, 60%), hsl({$hue +
                    150}, 70%, 50%));
                "
            >
                <span class="element-label">B</span>
            </div>
        </div>
    </div>

    <!-- Sync indicator -->
    <div class="sync-info">
        <div class="sync-badge">
            <i class="fa-solid fa-link"></i>
            Synchronized Timeline
        </div>
        <div class="values-container">
            <div class="value-item">
                <span class="value-label">time A:</span>
                <span class="value-number">{($time / 1000).toFixed(1)}s</span>
            </div>
            <div class="value-divider">=</div>
            <div class="value-item">
                <span class="value-label">time B:</span>
                <span class="value-number">{($time2 / 1000).toFixed(1)}s</span>
            </div>
        </div>
    </div>
</div>

<style>
    .synced-container {
        display: flex;
        gap: 40px;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
    }

    .element-wrapper {
        position: relative;
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .sync-element {
        width: 100px;
        height: 100px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
            0 0 30px rgba(255, 255, 255, 0.2),
            0 10px 40px rgba(0, 0, 0, 0.3),
            inset 0 0 30px rgba(255, 255, 255, 0.1);
        will-change: transform;
        position: relative;
    }

    .element-label {
        font-size: 32px;
        font-weight: bold;
        color: white;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        position: relative;
        z-index: 2;
    }

    .sync-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }

    .sync-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        padding: 8px 16px;
        background: rgba(79, 172, 254, 0.2);
        border: 1px solid rgba(79, 172, 254, 0.4);
        border-radius: 20px;
        backdrop-filter: blur(10px);
    }

    .values-container {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 25px;
        backdrop-filter: blur(10px);
    }

    .value-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .value-label {
        font-family:
            'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .value-number {
        font-family:
            'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.9);
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        min-width: 80px;
        text-align: center;
    }

    .value-divider {
        font-size: 24px;
        font-weight: bold;
        color: rgba(79, 172, 254, 0.8);
        padding: 0 8px;
    }
</style>
