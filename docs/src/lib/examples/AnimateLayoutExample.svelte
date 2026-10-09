<script lang="ts">
    import { animateLayout } from '@humanspeak/svelte-motion'

    let on = $state(false)
    let root = $state<HTMLElement | null>(null)

    const toggle = () => {
        if (!root) return
        animateLayout(
            root,
            () => {
                on = !on
            },
            {
                type: 'spring',
                visualDuration: 0.35,
                bounce: 0.25
            }
        )
    }
</script>

<div class="flex h-48 flex-col items-center justify-center gap-4" bind:this={root}>
    <button
        type="button"
        class="switch"
        class:on
        role="switch"
        aria-checked={on}
        aria-label="Toggle"
        onclick={toggle}
    >
        <span class="knob" data-layout></span>
    </button>
    <p class="text-sm text-text-muted">
        Click the switch — the knob is a plain &lt;span data-layout&gt;
    </p>
</div>

<style>
    .switch {
        display: flex;
        justify-content: flex-start;
        box-sizing: border-box;
        width: 112px;
        height: 56px;
        padding: 7px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        border-radius: 0;
        background: var(--brut-bg, #f8fcfb);
        cursor: pointer;
        transition: background-color 0.25s;
    }

    .switch.on {
        justify-content: flex-end;
        background: var(--brut-accent, #247768);
    }

    .knob {
        display: block;
        box-sizing: border-box;
        width: 40px;
        height: 40px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
    }

    .switch.on .knob {
        background: var(--brut-bg, #f8fcfb);
    }
</style>
