<script lang="ts">
    import { motion } from '$lib/index.js'

    const initialAspectRatio = 1
    const initialWidth = 100

    let aspectRatio = $state(initialAspectRatio)
    let width = $state(initialWidth)

    // Debounced values
    let debouncedAspectRatio = $state(initialAspectRatio)
    let debouncedWidth = $state(initialWidth)

    let arTimeout: ReturnType<typeof setTimeout> | null = null
    let wTimeout: ReturnType<typeof setTimeout> | null = null

    $effect(() => {
        // Track aspectRatio so this effect re-runs when it changes
        const current = $state.snapshot(aspectRatio)
        if (arTimeout) clearTimeout(arTimeout)
        arTimeout = setTimeout(() => {
            debouncedAspectRatio = current
        }, 200)
        return () => {
            if (arTimeout) {
                clearTimeout(arTimeout)
                arTimeout = null
            }
        }
    })

    $effect(() => {
        // Track width so this effect re-runs when it changes
        const current = $state.snapshot(width)
        if (wTimeout) clearTimeout(wTimeout)
        wTimeout = setTimeout(() => {
            debouncedWidth = current
        }, 200)
        return () => {
            if (wTimeout) {
                clearTimeout(wTimeout)
                wTimeout = null
            }
        }
    })
</script>

<div id="example">
    <div class="container">
        <motion.div
            style={`width: ${debouncedWidth}px; background-color: #8df0cc; aspect-ratio: ${debouncedAspectRatio} ; border-radius: 20px;`}
            transition={{ duration: 0.25 }}
            data-testid="aspect-box"
            layout
        />
    </div>
    <div class="inputContainer">
        <div class="inputs">
            <label>
                <code>Aspect ratio</code>
                <input type="range" min="0.1" max="5" step="0.1" bind:value={aspectRatio} />
                <input type="number" min="0.1" max="5" step="0.1" bind:value={aspectRatio} />
            </label>
            <label>
                <code>Width</code>
                <input type="range" min="10" max="1000" step="5" bind:value={width} />
                <input type="number" min="10" max="1000" step="5" bind:value={width} />
            </label>
        </div>
    </div>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 300px;
        height: 300px;
        gap: 20px;
    }

    .inputContainer {
        display: flex;
        flex-direction: row;
        gap: 20px;
        border-color: #0b1011;
        border-width: 1px;
        padding: 20px 40px;
        border-radius: 10px;
        position: relative;
        z-index: 2;
    }

    #example {
        display: flex;
        align-items: center;
        flex-direction: column;
    }

    #example input {
        accent-color: #8df0cc;
        font-family: 'Azeret Mono', monospace;
        font-size: 12px;
    }

    #example .inputs {
        display: flex;
        flex-direction: column;
        padding-left: 50px;
    }

    #example label {
        display: flex;
        align-items: center;
        margin: 10px 0;
        font-size: 12px;
    }

    #example label code {
        width: 100px;
    }

    #example input[type='number'] {
        border: 0;
        border-bottom: 1px dotted #8df0cc;
        color: #8df0cc;
        margin-left: 10px;
        background: transparent;
    }

    #example input[type='number']:focus {
        outline: none;
        border-bottom: 2px solid #8df0cc;
    }

    #example input[type='number']::-webkit-inner-spin-button {
        -webkit-appearance: none;
    }

    input[type='range']::-webkit-slider-runnable-track {
        height: 10px;
        -webkit-appearance: none;
        background: #0b1011;
        border: 1px solid #1d2628;
        border-radius: 10px;
        margin-top: -1px;
    }

    input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 20px;
        width: 20px;
        border-radius: 50%;
        background: #8df0cc;
        top: -4px;
        position: relative;
    }
</style>
