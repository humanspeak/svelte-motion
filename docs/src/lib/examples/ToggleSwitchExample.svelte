<!--
  @component
  A toggle switch that demonstrates custom easing functions with both bounce and spring animations.
  Shows FLIP layout animations with different transition types based on toggle state.
-->
<script lang="ts">
    import { motion, type MotionTransition } from '@humanspeak/svelte-motion'

    let isOn = $state(true)

    // From https://easings.net/#easeOutBounce
    const bounceEase = (x: number): number => {
        const n1 = 7.5625
        const d1 = 2.75

        if (x < 1 / d1) {
            return n1 * x * x
        } else if (x < 2 / d1) {
            return n1 * (x -= 1.5 / d1) * x + 0.75
        } else if (x < 2.5 / d1) {
            return n1 * (x -= 2.25 / d1) * x + 0.9375
        } else {
            return n1 * (x -= 2.625 / d1) * x + 0.984375
        }
    }

    const bounce: MotionTransition = {
        duration: 1.2,
        ease: bounceEase
    }

    const spring: MotionTransition = {
        type: 'spring',
        stiffness: 700,
        damping: 30
    }

    // Use spring when turning on, bounce when turning off
    const currentTransition = $derived(isOn ? spring : bounce)
</script>

<div class="container">
    <button
        class="switch"
        class:is-on={isOn}
        onclick={() => (isOn = !isOn)}
        type="button"
        aria-label={isOn ? 'Turn off' : 'Turn on'}
    >
        <motion.div class="ball" layout transition={currentTransition} />
    </button>
</div>

<style>
    .container {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        min-height: 300px;
    }

    .switch {
        width: 80px;
        height: 200px;
        background-color: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: flex-end;
        border-radius: 50px;
        padding: 10px;
        cursor: pointer;
        border: none;
        transition: background-color 0.3s;
    }

    .switch:hover {
        background-color: rgba(255, 255, 255, 0.25);
    }

    .switch.is-on {
        align-items: flex-start;
    }

    :global(.ball) {
        width: 60px;
        height: 60px;
        background-color: #f5f5f5;
        border-radius: 30px;
        will-change: transform;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
</style>
