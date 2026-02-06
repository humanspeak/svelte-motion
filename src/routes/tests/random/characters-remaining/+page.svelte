<script lang="ts">
    import { motion, animate, transform } from '$lib'

    let value = $state('')
    const maxLength = 12
    let charactersRemaining = $derived(maxLength - value.length)
    let counterEl: HTMLElement | null = $state(null)

    const mapRemainingToColor = transform([2, 6], ['#ff008c', '#ccc'])

    $effect(() => {
        if (charactersRemaining > 6 || !counterEl) return

        const mapRemainingToSpringVelocity = transform([0, 5], [50, 0])

        animate(
            counterEl,
            { scale: 1 },
            {
                type: 'spring',
                velocity: mapRemainingToSpringVelocity(charactersRemaining),
                stiffness: 700,
                damping: 80
            }
        )
    })
</script>

<div
    style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #0f1115;
    "
>
    <div class="container">
        <input bind:value />
        <div>
            <motion.span
                bind:ref={counterEl}
                style="color: {mapRemainingToColor(charactersRemaining)}; will-change: transform;"
            >
                {charactersRemaining}
            </motion.span>
        </div>
    </div>
</div>

<style>
    .container,
    .container input {
        position: relative;
        font-size: 32px;
        line-height: 1;
    }

    .container input {
        background-color: #0b1011;
        color: #f5f5f5;
        border: 2px solid #1d2628;
        border-radius: 10px;
        padding: 20px;
        padding-right: 70px;
        width: 300px;
    }

    .container input:focus {
        border-color: #3b82f6;
        outline: none;
    }

    .container div {
        color: #ccc;
        background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, #0b1011 20%);
        position: absolute;
        top: 50%;
        right: 2px;
        transform: translateY(-50%);
        padding: 10px;
        padding-right: 20px;
        padding-left: 50px;
    }

    .container div :global(span) {
        display: block;
    }
</style>
