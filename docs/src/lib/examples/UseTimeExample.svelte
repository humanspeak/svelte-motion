<script lang="ts">
    import { useTime } from '@humanspeak/svelte-motion'
    import { derived } from 'svelte/store'

    const time = useTime()

    // Create multiple derived animations from the same timeline
    const x = derived(time, (t) => Math.sin(t / 1000) * 80)
    const y = derived(time, (t) => Math.cos(t / 1200) * 60)
    const rotate = derived(time, (t) => (t / 15) % 360)
    const scale = derived(time, (t) => 1 + Math.sin(t / 800) * 0.15)
    const hue = derived(time, (t) => (t / 20) % 360)
</script>

<div class="flex min-h-[400px] items-center justify-center p-8">
    <div class="scene">
        <div
            class="orb"
            style="
                transform: translate({$x}px, {$y}px) rotate({$rotate}deg) scale({$scale});
                background: linear-gradient(135deg, hsl({$hue}, 70%, 60%), hsl({$hue +
                60}, 70%, 50%));
            "
        >
            <div class="inner-glow"></div>
        </div>

        <!-- Time display -->
        <div class="time-display">
            {Math.floor($time / 1000)}s
        </div>
    </div>
</div>

<style>
    .scene {
        position: relative;
        width: 300px;
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .orb {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        position: relative;
        box-shadow:
            0 0 40px rgba(255, 255, 255, 0.3),
            0 0 80px rgba(255, 255, 255, 0.2),
            inset 0 0 40px rgba(255, 255, 255, 0.2);
        will-change: transform;
    }

    .inner-glow {
        position: absolute;
        top: 20%;
        left: 20%;
        width: 40%;
        height: 40%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent);
        filter: blur(10px);
    }

    .time-display {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-family: monospace;
        font-size: 18px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.8);
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 20px;
        backdrop-filter: blur(10px);
    }
</style>
