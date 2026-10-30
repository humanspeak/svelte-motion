<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Port of upstream motion `dev/react/src/tests/layout-shared-animate-presence.tsx`
    // @ v14.7.1, checked by `packages/framer-motion/cypress/integration/layout-shared.ts`
    // (65-86, "removed element isn't removed until animation is complete").
    // e2e/layout-id/presence-crossfade.spec.ts (plan 012).
    //
    // One `layoutId="box"` shape inside `AnimatePresence`, keyed by `count`.
    // A click cycles `count`: the old shape exits (it has no `exit`) and the
    // new one enters with the same layoutId. The old shape is held until the
    // shared animation ends, follows the new one and crossfades out. The
    // transition is 10 s with `ease: () => 0.25`, so the crossfade is frozen
    // a quarter of the way in.
    //
    // Deviations:
    // - Svelte has no `key` remount on a single child, so the clone syntax
    //   is `{#key count}` around a `motion.div key="shape-{count}"`.
    // - `?owned=true` uses the owned syntax with two alternating boundaries,
    //   A present while `count` is even and B while it is odd. A snippet
    //   reads live state, where upstream re-renders an exiting child with its
    //   last props, so each boundary latches the `count` it was shown with
    //   (its id, style and `animate` entry).
    // - `?solo=<n>` renders only shape n, at rest, for the spec's colour
    //   calibration.
    // - `?duration=<s>` (default 10, as upstream) sets the transition length.
    //
    // Plan 012 placement probes (3d), each a separate fixture: `?probe=enter`
    // (3d-i), `?probe=styles` (3d-ii), `?probe=margin` (3d-iii),
    // `?probe=values` (3d-iv), `?probe=transform`, `?probe=filter` and
    // `?probe=backdrop` (3d-v).

    const params = page.url.searchParams
    const owned = params.get('owned') === 'true'
    const solo = params.get('solo')
    const probe = params.get('probe')

    let count = $state(0)
    // Set on mount, so the specs don't click before hydration.
    let hydrated = $state(false)
    const cycle = () => (count = (count + 1) % 4)

    // Owned: the count each boundary was last shown with (see the header).
    let shownA = $state(0)
    let shownB = $state(1)
    $effect.pre(() => {
        if (count % 2 === 0) shownA = count
        else shownB = count
    })

    // `?duration=<s>` changes only the shared transition's length (plan 012
    // A1), so the specs can check the release without waiting 10 s.
    const transition = { duration: Number(params.get('duration') ?? 10), ease: () => 0.25 }

    const animate = [
        { backgroundColor: '#09f', borderRadius: 10, opacity: 1 },
        { backgroundColor: '#90f', borderRadius: 100, opacity: 0.5 },
        { backgroundColor: '#f09', borderRadius: 0, opacity: 1 },
        { backgroundColor: '#9f0', borderRadius: 50, opacity: 0.5 }
    ]

    const styles: Record<string, string | number>[] = [
        { width: 100, height: 100, top: 100 },
        { width: 200, height: 200, left: 100 },
        { width: 100, height: 100, left: 'calc(100vw - 100px)' },
        { width: 200, height: 200 }
    ]

    // ---- Placement probes (plan 012, 3d) ----
    let probeShown = $state(true)
    const removeProbe = () => (probeShown = false)
    const probeExit = { opacity: 0, transition: { duration: 1 } }
    const enterTransition = { duration: 1, ease: 'linear' as const }

    // ---- Live verdict (tester only) ----
    //
    // After a click, sample the frame for 600 ms: both shapes must stay
    // mounted (the old one is held without an `exit`), and the point at the
    // new shape's centre must hit the new shape (the old one paints under
    // it, as upstream renders the exiting child first).
    type Verdict = 'waiting' | 'sampling' | 'held' | 'removed' | 'on-top'
    let verdict = $state<Verdict>('waiting')
    let readout = $state<string | null>(null)

    onMount(() => {
        hydrated = true
        if (window.location.search.includes('@isPlaywright=true')) return
        let last = count
        let raf = 0
        let watching: { from: number; to: number; start: number } | null = null
        let bothFrames = 0
        let frames = 0
        let onTop = false
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            if (count !== last) {
                watching = { from: last, to: count, start: now }
                last = count
                bothFrames = 0
                frames = 0
                onTop = false
                verdict = 'sampling'
            }
            if (!watching) return
            frames++
            const old = document.getElementById(`shape-${watching.from}`)
            const next = document.getElementById(`shape-${watching.to}`)
            if (old && next) bothFrames++
            if (next) {
                const r = next.getBoundingClientRect()
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
                if (hit && hit.closest('[id]')?.id === `shape-${watching.from}`) onTop = true
            }
            if (now - watching.start > 600) {
                verdict = onTop ? 'on-top' : bothFrames === frames ? 'held' : 'removed'
                readout = `both mounted in ${bothFrames}/${frames} frames`
                watching = null
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const steps: TesterStep[] = [
        {
            text: 'Click the blue square.',
            expected:
                'A purple 200px square appears and the blue square stays mounted, sitting on it with the two colours blended (the animation is frozen a quarter of the way in). The chip reads HELD ✓.',
            action: { label: 'Click the shape', run: cycle }
        },
        {
            text: 'Click again, and twice more.',
            expected:
                'Each click leaves the previous shape mounted under the new one, blended with it. HELD ✓ every time, never REMOVED or ON TOP.',
            action: { label: 'Click the shape', run: cycle }
        },
        {
            text: 'Open the owned variant (link below) and repeat.',
            expected: 'The same: HELD ✓ for every click.'
        }
    ]
</script>

<svelte:head>
    <title>layoutId · exiting element crossfades with AnimatePresence</title>
</svelte:head>

{#snippet shape(c: number)}
    <motion.div
        initial={false}
        style={{ position: 'absolute', ...styles[c] }}
        {transition}
        animate={animate[c]}
        layoutId="box"
        id="shape-{c}"
        onclick={cycle}
    />
{/snippet}

{#if probe}
    <!-- Outside the fixed fixture: 3d-iii needs no positioned ancestor. -->
    <div class="probes" data-probe={probe} data-hydrated={hydrated || undefined}>
        {#if probe === 'enter'}
            <div class="probe-row">
                <AnimatePresence>
                    {#if probeShown}
                        <motion.div
                            key="probe"
                            id="probe"
                            class="probe-box"
                            layout
                            initial={{ x: -100, scale: 0.5 }}
                            animate={{ x: 0, scale: 1 }}
                            transition={enterTransition}
                            exit={probeExit}
                        />
                    {/if}
                </AnimatePresence>
                <motion.div
                    id="control"
                    class="probe-box control"
                    initial={{ x: -100, scale: 0.5 }}
                    animate={{ x: 0, scale: 1 }}
                    transition={enterTransition}
                />
            </div>
        {:else if probe === 'styles'}
            <div class="probe-stage">
                <AnimatePresence>
                    {#if probeShown}
                        <motion.div
                            key="probe"
                            id="probe"
                            class="probe-box"
                            layout
                            style={{
                                position: 'absolute',
                                top: 40,
                                left: 60,
                                width: 120,
                                marginLeft: 10
                            }}
                            exit={probeExit}
                        />
                    {/if}
                </AnimatePresence>
            </div>
        {:else if probe === 'margin'}
            <div class="probe-tall">
                <AnimatePresence>
                    {#if probeShown}
                        <motion.div
                            key="probe"
                            id="probe"
                            class="probe-box"
                            layout
                            style="margin: 12px;"
                            exit={probeExit}
                        />
                    {/if}
                </AnimatePresence>
                <div class="probe-after">after</div>
            </div>
        {:else if probe === 'values'}
            <div class="probe-row">
                <AnimatePresence>
                    {#if probeShown}
                        <motion.div
                            key="probe"
                            id="probe"
                            class="probe-box content-box"
                            layout
                            style={{ marginLeft: 10, width: 120, padding: 8 }}
                            exit={probeExit}
                        />
                    {/if}
                </AnimatePresence>
            </div>
        {:else}
            <div class="probe-outer">
                <div
                    class="probe-cb"
                    style={probe === 'transform'
                        ? 'transform: translateX(0)'
                        : probe === 'filter'
                          ? 'filter: blur(0)'
                          : 'backdrop-filter: blur(0)'}
                >
                    <AnimatePresence>
                        {#if probeShown}
                            <motion.div
                                key="probe"
                                id="probe"
                                class="probe-box"
                                layout
                                style="position: {probe === 'transform'
                                    ? 'absolute'
                                    : 'fixed'}; top: 30px; left: 40px;"
                                exit={probeExit}
                            />
                        {/if}
                    </AnimatePresence>
                </div>
            </div>
        {/if}
        <button id="remove-probe" type="button" onclick={removeProbe}>remove</button>
    </div>
{:else}
    <div class="fixture" data-hydrated={hydrated || undefined}>
        {#if solo !== null}
            <motion.div
                initial={false}
                style={{ position: 'absolute', ...styles[Number(solo)] }}
                animate={animate[Number(solo)]}
                id="shape-{solo}"
            />
        {:else if owned}
            <AnimatePresence present={count % 2 === 0}>
                {#snippet child()}
                    {@render shape(shownA)}
                {/snippet}
            </AnimatePresence>
            <AnimatePresence present={count % 2 === 1}>
                {#snippet child()}
                    {@render shape(shownB)}
                {/snippet}
            </AnimatePresence>
        {:else}
            <AnimatePresence>
                {#key count}
                    <motion.div
                        key="shape-{count}"
                        initial={false}
                        style={{ position: 'absolute', ...styles[count] }}
                        {transition}
                        animate={animate[count]}
                        layoutId="box"
                        id="shape-{count}"
                        onclick={cycle}
                    />
                {/key}
            </AnimatePresence>
        {/if}
    </div>
{/if}

<TesterPanel
    eyebrow="Motion 14.7.1 · layout-shared-animate-presence"
    title="Exiting layoutId element crossfades"
    status="Plan 012: the old shape is held and crossfades into the new one on both syntaxes."
    {steps}
>
    {#snippet summary()}
        <span
            class="verdict {verdict === 'held'
                ? 'ok'
                : verdict === 'waiting' || verdict === 'sampling'
                  ? 'na'
                  : 'bad'}"
        >
            {verdict === 'held'
                ? 'HELD ✓'
                : verdict === 'removed'
                  ? 'REMOVED ✗'
                  : verdict === 'on-top'
                    ? 'ON TOP ✗'
                    : verdict === 'sampling'
                      ? 'SAMPLING'
                      : 'WAITING'}
        </span>
        {#if readout}<span class="readout">{readout}</span>{/if}
    {/snippet}
    {#snippet checks()}
        <p>
            Upstream keeps an exiting <code>layoutId</code> element mounted until the new lead's
            shared animation completes, even without an <code>exit</code> prop: it is relegated in its
            stack, follows the new element and fades out while the new one fades in.
        </p>
        <p>
            Variants: <a href="?owned=true">owned</a> · <a href="?">clone (default)</a>
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        inset: 0;
        background: white;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .probes {
        width: 100%;
        align-self: flex-start;
    }
    .probe-row {
        display: flex;
        gap: 40px;
        padding: 80px;
    }
    .probe-stage {
        position: relative;
        margin: 60px;
        width: 400px;
        height: 300px;
        background: #f4f4f4;
    }
    .probe-tall {
        padding: 20px;
        height: 3000px;
    }
    .probe-outer {
        position: relative;
        padding: 40px;
    }
    .probe-cb {
        margin: 50px 0 0 70px;
        width: 300px;
        height: 200px;
        background: #f4f4f4;
    }
    .probes :global(.probe-box) {
        width: 100px;
        height: 100px;
        background: #09f;
        box-sizing: border-box;
    }
    .probes :global(.probe-box.control) {
        background: #f09;
    }
    .probes :global(.probe-box.content-box) {
        box-sizing: content-box;
        border: 3px solid #036;
    }
    .probe-after {
        height: 40px;
        background: #f09;
    }
    #remove-probe {
        position: fixed;
        bottom: 10px;
        left: 10px;
    }
    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
    .readout {
        font-size: 0.75rem;
        color: #475569;
    }
</style>
