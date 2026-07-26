<script lang="ts">
    /**
     * THROWAWAY SPIKE — Candidate A, LOCAL outro (default `out:...`, no
     * `|global`). Identical to SpikeExitBoxGlobal except for the modifier, so
     * the two can be compared directly in the same nesting shapes.
     */
    import { onDestroy } from 'svelte'
    import { spikeExit, type SpikeExitParams } from './spikeExitTransition'
    import { spikeLog } from './spike-log'

    type Props = { id: string; params?: Partial<SpikeExitParams>; label?: string }
    const { id, params = {}, label }: Props = $props()

    onDestroy(() => {
        spikeLog('onDestroy', { id })
    })
</script>

<div
    class="spike-box"
    data-spike-box={id}
    out:spikeExit={{ id, ...params }}
    onoutrostart={() => spikeLog('outrostart', { id })}
    onoutroend={() => spikeLog('outroend', { id })}
>
    {label ?? id}
</div>

<style>
    .spike-box {
        background: #0f766e;
        color: white;
        padding: 1rem 1.25rem;
        border-radius: 0.5rem;
        font: 600 14px/1.2 system-ui;
    }
</style>
