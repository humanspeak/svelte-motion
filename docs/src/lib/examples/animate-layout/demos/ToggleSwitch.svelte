<script lang="ts">
    import { animateLayout } from '@humanspeak/svelte-motion'

    // A switch knob on a plain <div data-layout>. The state flip moves the
    // knob with justify-content; animateLayout measures it before and after
    // the update and springs it between the two boxes. No motion component.

    let on = $state(false)
    let root = $state<HTMLElement | null>(null)

    const toggle = () => {
        if (!root) return
        // Scoped to this demo so other tagged elements on the page stay put.
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

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip" bind:this={root}>
        <div class="strip-head">
            <span class="micro">// toggle switch</span>
            <span class="micro readout">state · {on ? 'on' : 'off'}</span>
        </div>

        <div class="stage">
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
        </div>

        <div class="strip-foot">
            <span class="micro">attr: data-layout</span>
            <span class="micro">update: on = !on</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 400px;
    }

    .strip {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: min(100%, 360px);
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .readout {
        color: var(--brut-accent, #247768);
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
    }

    /* The layout change itself: justify-content flips the knob's side. */
    .switch {
        display: flex;
        justify-content: flex-start;
        box-sizing: border-box;
        width: 128px;
        height: 64px;
        padding: 8px;
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
        width: 46px;
        height: 46px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
    }

    .switch.on .knob {
        background: var(--brut-bg, #f8fcfb);
    }
</style>
