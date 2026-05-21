<script lang="ts">
    import { animate } from 'motion'

    // Side-by-side comparison of how the browser's Web Animations API
    // and motion's `animate()` interpolate between two colors. WAAPI
    // interpolates in HSL (the path sweeps through hue), motion
    // interpolates in RGB (a straight line through colour space).

    let waapiElement: HTMLDivElement | undefined = $state(undefined)
    let motionElement: HTMLDivElement | undefined = $state(undefined)

    $effect(() => {
        if (!waapiElement || !motionElement) return

        // Web Animations API — HSL interpolation
        const waapiAnimation = waapiElement.animate(
            [{ backgroundColor: '#ff0088' }, { backgroundColor: '#0d63f8' }],
            {
                duration: 2000,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'linear'
            }
        )

        // motion — RGB interpolation
        const motionAnimation = animate(
            motionElement,
            { backgroundColor: ['#ff0088', '#0d63f8'] },
            {
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'linear'
            }
        )

        return () => {
            waapiAnimation.cancel()
            motionAnimation.cancel()
        }
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="container">
        <div class="swatch-container">
            <div class="swatch waapi" bind:this={waapiElement}></div>
            <div class="label">Browser (HSL)</div>
        </div>
        <div class="swatch-container">
            <div class="swatch motion" bind:this={motionElement}></div>
            <div class="label">Motion (RGB)</div>
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

    .container {
        display: flex;
        gap: 30px;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
    }

    .swatch-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
    }

    .swatch {
        width: 100px;
        height: 100px;
        border-radius: 8px;
        background-color: #ff0088;
        box-shadow:
            0 4px 6px -1px rgb(0 0 0 / 0.1),
            0 2px 4px -2px rgb(0 0 0 / 0.1);
    }

    .label {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary, #6b7280);
    }
</style>
