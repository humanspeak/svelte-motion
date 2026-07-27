<script lang="ts">
    /**
     * THROWAWAY SPIKE — Candidate A, GLOBAL outro (`out:...|global`).
     *
     * Stands in for a motion component: the element is created by THIS
     * component's template, which is why an `out:` directive can be attached
     * "from the inside" at all (answer to Step 1 question (a)).
     */
    import { onDestroy, onMount } from 'svelte'
    import { spikeExit, type SpikeExitParams } from './spikeExitTransition'
    import { spikeLog } from './spike-log'

    type Props = { id: string; params?: Partial<SpikeExitParams>; label?: string }
    const { id, params = {}, label }: Props = $props()

    let tick = $state(0)
    let interval: ReturnType<typeof setInterval> | undefined

    onMount(() => {
        interval = setInterval(() => {
            tick += 1
        }, 50)
        return () => clearInterval(interval)
    })

    // Probe: does a component's $effect keep running while its block is paused
    // for an outro? (`pause_effect` marks the subtree INERT — effects.js:609.)
    $effect(() => {
        spikeLog('effect-run', { id, tick })
    })

    onDestroy(() => {
        spikeLog('onDestroy', { id })
    })
</script>

<div
    class="spike-box"
    data-spike-box={id}
    out:spikeExit|global={{ id, ...params }}
    onoutrostart={() => spikeLog('outrostart', { id })}
    onoutroend={() => spikeLog('outroend', { id })}
>
    {label ?? id}
</div>

<style>
    .spike-box {
        background: #4f46e5;
        color: white;
        padding: 1rem 1.25rem;
        border-radius: 0.5rem;
        font: 600 14px/1.2 system-ui;
    }
</style>
