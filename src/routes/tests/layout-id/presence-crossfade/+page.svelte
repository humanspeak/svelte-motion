<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import { SvelteURLSearchParams } from 'svelte/reactivity'
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
    // - Only the specs (`@isPlaywright=true`) run upstream's frozen 10 s
    //   transition. A human tester gets a 6 s linear one to watch, and the
    //   probes run 6 times slower (`?slow=<n>`); `?ease=frozen` restores
    //   upstream's. `?duration=<s>` sets the length either way.
    // - The third shape stops 360px short of the right edge for a human
    //   tester, so the TesterPanel doesn't cover it.
    //
    // Plan 012 placement probes (3d), each a separate fixture: `?probe=enter`
    // (3d-i), `?probe=styles` (3d-ii), `?probe=margin` (3d-iii),
    // `?probe=values` (3d-iv), `?probe=transform`, `?probe=filter` and
    // `?probe=backdrop` (3d-v).
    //
    // `?probe=switch` (plan 012 A3): a `layoutId` shape interrupted mid
    // transform-enter (`scaleX` 0 → 1 over 1 s) by a switch to another slot;
    // the held shape must follow the new one on every frame, as in the
    // framer-motion 14.7.1 repro. `&owned=true` uses `present` + `child`.

    const params = page.url.searchParams
    const isPlaywright = params.get('@isPlaywright') === 'true'
    const owned = params.get('owned') === 'true'
    // A URL for this page with some params changed, keeping the tester's
    // others (`null` removes one).
    const hrefWith = (changes: Record<string, string | null>) => {
        const next = new SvelteURLSearchParams(params)
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key)
            else next.set(key, value)
        }
        const query = next.toString()
        return query ? `?${query}` : '?'
    }
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

    // The specs (`@isPlaywright=true`) run upstream's transition: 10 s, frozen
    // a quarter of the way in by `ease: () => 0.25`. A human tester gets a
    // watchable 6 s linear crossfade instead; `?ease=frozen` restores
    // upstream's. `?duration=<s>` sets the length either way (plan 012 A1:
    // the specs check the release with a short one).
    const frozen =
        params.get('ease') === 'frozen' || (isPlaywright && params.get('ease') !== 'linear')
    const duration = Number(params.get('duration') ?? (isPlaywright ? 10 : 6))
    const transition = { duration, ease: frozen ? () => 0.25 : ('linear' as const) }

    const animate = [
        { backgroundColor: '#09f', borderRadius: 10, opacity: 1 },
        { backgroundColor: '#90f', borderRadius: 100, opacity: 0.5 },
        { backgroundColor: '#f09', borderRadius: 0, opacity: 1 },
        { backgroundColor: '#9f0', borderRadius: 50, opacity: 0.5 }
    ]

    // Upstream puts shape 2 at the window's right edge. For a human tester that
    // is under the 360px TesterPanel, so it stops short of the panel; the specs
    // (`@isPlaywright=true`, panel hidden) keep upstream's value.
    const rightEdge = isPlaywright ? 'calc(100vw - 100px)' : 'calc(100vw - 460px)'

    const styles: Record<string, string | number>[] = [
        { width: 100, height: 100, top: 100 },
        { width: 200, height: 200, left: 100 },
        { width: 100, height: 100, left: rightEdge },
        { width: 200, height: 200 }
    ]

    // ---- Placement probes (plan 012, 3d) ----
    let probeShown = $state(true)
    const removeProbe = () => (probeShown = false)
    // `?slow=<n>` stretches the probes' timings n times so they can be
    // watched. A human tester gets 6 by default; the specs run at 1.
    const slow = Number(params.get('slow') ?? (isPlaywright ? 1 : 6))
    const probeExit = { opacity: 0, transition: { duration: slow } }
    const enterTransition = { duration: slow, ease: 'linear' as const }
    let switchSlot = $state<'none' | 'a' | 'b'>('none')

    // ---- Live verdict (tester only) ----
    //
    // After a click, watch every frame until the old shape is released (or
    // the shared animation plus 2 s has passed):
    // - both shapes stay mounted while the shared animation runs (the old
    //   one is held without an `exit`);
    // - the point at the new shape's centre hits the new shape (the old one
    //   paints under it, as upstream renders the exiting child first);
    // - the old shape is released once the animation ends.
    // With the frozen ease the animation never visibly ends, so the verdict
    // is given after 600 ms.
    type Verdict = 'waiting' | 'watching' | 'ok' | 'removed' | 'on-top' | 'stuck'
    let verdict = $state<Verdict>('waiting')
    let readout = $state<string | null>(null)

    onMount(() => {
        hydrated = true
        if (isPlaywright || probe) return
        let last = count
        let raf = 0
        let watching: { from: number; to: number; start: number } | null = null
        let onTop = false
        const finish = (next: Verdict, text: string) => {
            verdict = next
            readout = text
            watching = null
        }
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            if (count !== last) {
                watching = { from: last, to: count, start: now }
                last = count
                onTop = false
                verdict = 'watching'
                readout = null
            }
            if (!watching) return
            const elapsed = (now - watching.start) / 1000
            const old = document.getElementById(`shape-${watching.from}`)
            const next = document.getElementById(`shape-${watching.to}`)
            if (next) {
                const r = next.getBoundingClientRect()
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
                if (hit && hit.closest('[id]')?.id === `shape-${watching.from}`) onTop = true
            }
            if (onTop) return finish('on-top', 'the old shape painted over the new one')
            if (frozen) {
                if (elapsed > 0.6)
                    finish(old ? 'ok' : 'removed', old ? 'held (frozen ease)' : 'removed at once')
                return
            }
            if (!old) {
                if (elapsed < duration * 0.95)
                    finish('removed', `removed after ${elapsed.toFixed(1)} s, before the end`)
                else finish('ok', `held ${elapsed.toFixed(1)} s, then released`)
            } else if (elapsed > duration + 2) {
                finish('stuck', `still mounted ${elapsed.toFixed(1)} s later`)
            } else {
                readout = `held ${elapsed.toFixed(1)} s…`
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const watchSteps: TesterStep[] = [
        {
            text: 'Click the blue square (or the button), then watch for the whole animation.',
            expected: `Over ${duration} s the shape grows into a pale purple circle. The blue square travels with it, sitting exactly on top, and fades out by the end. The chip reads HELD ✓ "held ${duration}.0 s, then released".`,
            action: { label: 'Click the shape', run: cycle }
        },
        {
            text: 'Click three more times, letting each animation finish.',
            expected:
                'A small pink square near the panel, then a pale green circle, then back to blue. Each time the previous shape rides on top of the new one and fades out at the end. Never REMOVED, ON TOP or STUCK.',
            action: { label: 'Click the shape', run: cycle }
        },
        {
            text: 'Click "switch to owned" next to the chip, and repeat steps 1–2.',
            expected: 'The same as the default (clone) syntax.'
        },
        {
            text: 'Click "mid-enter case" next to the chip.',
            expected: 'That page has its own steps.'
        }
    ]
    const switchSteps: TesterStep[] = [
        {
            text: 'Click "start" on the left.',
            expected: `A blue bar grows from nothing to full width over ${slow} s.`
        },
        {
            text: 'While it is still growing (about halfway), click "switch".',
            expected:
                "A pink bar takes over. It starts at the blue bar's size and place, never from zero width, and moves to its slot. The blue bar travels with it, on top, and fades out by the end."
        },
        {
            text: 'Reload, click "switch to owned", and repeat.',
            expected: 'The same.'
        }
    ]
    const steps = probe === 'switch' ? switchSteps : watchSteps
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
        {#snippet switchShape(s: 'a' | 'b')}
            <motion.div
                key={s}
                id="shape-{s}"
                layoutId="switch-shape"
                initial={s === 'a' ? { scaleX: 0 } : false}
                animate={{ scaleX: 1 }}
                transition={enterTransition}
                style="width: 200px; height: 40px; background: {s === 'a' ? '#09f' : '#f09'};"
            />
        {/snippet}
        {#if probe === 'switch'}
            <div class="switch-stage">
                {#each ['a', 'b'] as const as s (s)}
                    <div class="switch-slot switch-{s}">
                        {#if owned}
                            <AnimatePresence present={switchSlot === s}>
                                {#snippet child()}
                                    {@render switchShape(s)}
                                {/snippet}
                            </AnimatePresence>
                        {:else}
                            <AnimatePresence>
                                {#if switchSlot === s}
                                    {@render switchShape(s)}
                                {/if}
                            </AnimatePresence>
                        {/if}
                    </div>
                {/each}
                <button id="start" type="button" onclick={() => (switchSlot = 'a')}>start</button>
                <button id="switch" type="button" onclick={() => (switchSlot = 'b')}>switch</button>
            </div>
        {:else if probe === 'enter'}
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
        {#if !probe}
            <span
                class="verdict {verdict === 'ok'
                    ? 'ok'
                    : verdict === 'waiting' || verdict === 'watching'
                      ? 'na'
                      : 'bad'}"
            >
                {verdict === 'ok'
                    ? 'HELD ✓'
                    : verdict === 'removed'
                      ? 'REMOVED ✗'
                      : verdict === 'on-top'
                        ? 'ON TOP ✗'
                        : verdict === 'stuck'
                          ? 'STUCK ✗'
                          : verdict === 'watching'
                            ? 'WATCHING'
                            : 'WAITING'}
            </span>
            {#if readout}<span class="readout">{readout}</span>{/if}
        {/if}
        <span class="variants">
            {#if owned}
                Owned · <a href={hrefWith({ owned: null })}>switch to clone</a>
            {:else}
                Clone · <a href={hrefWith({ owned: 'true' })}>switch to owned</a>
            {/if}
            ·
            {#if probe === 'switch'}
                <a href={hrefWith({ probe: null })}>back to the crossfade</a>
            {:else}
                <a href={hrefWith({ probe: 'switch' })}>mid-enter case</a>
            {/if}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            Upstream keeps an exiting <code>layoutId</code> element mounted until the new lead's
            shared animation completes, even without an <code>exit</code> prop: it is relegated in its
            stack, follows the new element and fades out while the new one fades in.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .variants {
        margin-left: 0.75rem;
        font-size: 0.8rem;
    }
    .variants a {
        color: #2563eb;
        text-decoration: underline;
    }
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
    .switch-stage {
        position: fixed;
        inset: 0;
        background: white;
    }
    .switch-slot {
        position: absolute;
        width: 200px;
        height: 40px;
    }
    .switch-a {
        left: 100px;
        top: 100px;
    }
    .switch-b {
        left: 500px;
        top: 300px;
    }
    .switch-stage #start,
    .switch-stage #switch {
        position: absolute;
        top: 500px;
    }
    .switch-stage #switch {
        left: 100px;
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
