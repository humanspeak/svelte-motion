<script lang="ts">
    import { AnimatePresence } from '$lib'
    import PresenceDataCard from './PresenceDataCard.svelte'
    import PresenceDataProbe from './PresenceDataProbe.svelte'

    const cards = [
        { id: 'alpha', label: 'Alpha exits with latest parent data' },
        { id: 'bravo', label: 'Bravo enters from the selected direction' },
        { id: 'charlie', label: 'Charlie proves stale child props are avoided' }
    ]

    let index = $state(0)
    let direction: 1 | -1 = $state(1)
    const current = $derived(cards[index])

    function go(nextDirection: 1 | -1) {
        direction = nextDirection
        index = (index + nextDirection + cards.length) % cards.length
    }
</script>

<svelte:head>
    <title>usePresenceData</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">usePresenceData (#305)</p>
        <h1>Exiting children can read AnimatePresence custom data.</h1>
        <p>
            The child calls <code>usePresenceData()</code>. On each navigation, the leaving card
            should exit using the latest parent <code>custom</code> direction.
            <strong>Next</strong> sets <code>direction 1</code>, so the old card exits left and the
            new card enters from the right. <strong>Previous</strong> sets
            <code>direction -1</code>, so the old card exits right and the new card enters from the
            left.
        </p>
    </section>

    <section class="stage" data-testid="presence-data-stage">
        <div class="frame" data-testid="presence-data-frame">
            <AnimatePresence custom={direction} initial={false}>
                {#key current.id}
                    <PresenceDataCard id={current.id} label={current.label} />
                {/key}
            </AnimatePresence>
        </div>

        <div class="controls">
            <button type="button" data-testid="presence-data-prev" onclick={() => go(-1)}>
                Previous
            </button>
            <output data-testid="presence-data-direction">direction {direction}</output>
            <button type="button" data-testid="presence-data-next" onclick={() => go(1)}>
                Next
            </button>
        </div>
    </section>

    <section class="readouts" data-testid="presence-data-readouts">
        <div>
            <p class="kicker">outside AnimatePresence</p>
            <PresenceDataProbe />
        </div>
        <div>
            <p class="kicker">inside AnimatePresence</p>
            <AnimatePresence custom={direction}>
                <PresenceDataProbe />
            </AnimatePresence>
        </div>
    </section>
</main>

<style>
    :global(html),
    :global(body) {
        min-height: 100%;
        height: auto;
        margin: 0;
        overflow-y: auto;
        background: #0b1014;
        color: #e7f2fb;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    :global(body > .h-full),
    :global(body > .h-full > .h-full),
    :global(.container),
    :global(#sandbox) {
        min-height: 100vh;
        height: auto;
    }

    main {
        min-height: 100vh;
        width: min(880px, calc(100vw - 32px));
        display: grid;
        align-content: start;
        gap: 26px;
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 720px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #72d9f7;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: 34px;
        line-height: 1.08;
    }

    .intro p:not(.kicker) {
        margin: 12px 0 0;
        color: #b7c7d4;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #f5b7df;
    }

    .stage,
    .readouts {
        display: grid;
        gap: 18px;
        padding: 26px;
        border: 1px solid #263947;
        background:
            linear-gradient(90deg, rgba(114, 217, 247, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(114, 217, 247, 0.1) 1px, transparent 1px), #0e161c;
        background-size: 44px 44px;
    }

    .frame {
        position: relative;
        height: 260px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid #324a5b;
        background: rgba(9, 15, 20, 0.78);
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
    }

    button,
    output {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 14px;
        border: 1px solid #405767;
        border-radius: 6px;
        background: #121c24;
        color: #eef6fb;
        font-size: 13px;
        font-weight: 750;
    }

    button {
        cursor: pointer;
    }

    button:hover {
        border-color: #72d9f7;
    }

    .readouts {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .readouts > div {
        display: grid;
        gap: 10px;
        padding: 18px;
        border: 1px solid #324a5b;
        background: #101922;
    }
</style>
