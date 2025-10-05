<!--
  @component
  A comparison of color interpolation between Motion and the Web Animations API.
  Motion uses RGB interpolation by default, while WAAPI uses HSL interpolation.

  This demonstrates the difference in how colors transition between two values.
-->
<script lang="ts">
    import { animate } from 'motion'

    let waapiElement: HTMLDivElement | undefined = $state(undefined)
    let motionElement: HTMLDivElement | undefined = $state(undefined)

    $effect(() => {
        if (!waapiElement || !motionElement) return

        // Web Animations API - uses HSL interpolation
        const waapiAnimation = waapiElement.animate(
            [{ backgroundColor: '#ff0088' }, { backgroundColor: '#0d63f8' }],
            {
                duration: 2000,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'linear'
            }
        )

        // Motion - uses RGB interpolation
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

<style>
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
