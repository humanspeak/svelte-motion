<script lang="ts">
    import { animate, hover, stagger, useScopeMotion } from '@humanspeak/svelte-motion'

    // A staggered list in one useScopeMotion scope with media conditions.
    // Setup runs while either condition matches; crossing 800px cancels the
    // scope (restoring inline styles) and runs setup again, so the list
    // re-staggers in the new direction. The hover gesture is collected too.

    const items = ['Spring', 'Tween', 'Inertia', 'Keyframes', 'Stagger']

    let mode = $state('—')
    let runs = $state(0)

    const scope = useScopeMotion(
        ({ media }) => {
            runs += 1
            mode = media.wide ? 'wide · from first' : 'narrow · from last'

            // No per-call transition: the scope's default applies.
            animate(
                'li',
                { opacity: [0, 1], x: media.wide ? [-24, 0] : [24, 0] },
                { delay: stagger(0.07, { from: media.wide ? 'first' : 'last' }) }
            )

            hover('li', (element) => {
                animate(element, { x: media.wide ? 8 : -8 }, { duration: 0.2 })
                return () => animate(element, { x: 0 }, { duration: 0.2 })
            })
        },
        {
            transition: { type: 'spring', visualDuration: 0.45, bounce: 0.2 },
            matchMedia: { wide: '>=800', narrow: '<800' }
        }
    )
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// breakpoint stagger</span>
            <span class="micro readout">{mode}</span>
        </div>

        <ul class="list" {@attach scope}>
            {#each items as item (item)}
                <li>{item}</li>
            {/each}
        </ul>

        <div class="controls">
            <button type="button" onclick={() => scope.current?.refresh()}>Replay</button>
            <span class="micro">setup runs · {runs}</span>
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

    .strip-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .readout {
        color: var(--brut-accent, #247768);
    }

    .list {
        display: grid;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        box-sizing: border-box;
        padding: 0.75rem 1rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.875rem;
        cursor: default;
    }

    li:nth-child(odd) {
        background: var(--brut-accent, #247768);
        color: var(--brut-bg, #f8fcfb);
    }

    .controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-bg, #f8fcfb);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
</style>
