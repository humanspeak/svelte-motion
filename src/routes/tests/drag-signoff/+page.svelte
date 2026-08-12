<!--
@component
Sign-off tour for the drag-single-writer batch (#449 follow-up): drag,
momentum, whileDrag, whilePan and layout all write through the one
VisualElement per component. Each section states what it exercises, what
PASS looks like, and what a FAILURE would look like.
-->
<script lang="ts">
    import { motion, useMotionValue } from '$lib'

    // §2 live value readout during glide
    const glideY = useMotionValue(0)
    let glideReadout = $state('0')
    $effect(() => glideY.on('change', (v) => (glideReadout = v.toFixed(1))))

    // §5 whilePan target
    let panCount = $state(0)
</script>

<div class="min-h-screen bg-[#0b0d12] px-6 py-10 text-slate-200">
    <div class="mx-auto max-w-4xl space-y-16">
        <!-- ═══════════════ BANNER ═══════════════ -->
        <header class="rounded-2xl border-2 border-orange-400 bg-orange-400/10 p-8">
            <p class="text-sm font-bold tracking-widest text-orange-400">
                SIGN-OFF TOUR · DRAG SINGLE-WRITER (#449 FOLLOW-UP)
            </p>
            <h1 class="mt-2 text-4xl font-black text-white">Drag Through the VisualElement</h1>
            <p class="mt-4 max-w-3xl text-lg leading-relaxed">
                Drag was the last writer outside the VisualElement. Now its pointer writes, momentum
                physics, <code>whileDrag</code>, <code>whilePan</code> and the layoutId FLIP all
                flow through
                <strong class="text-orange-300">the same node as every other animation</strong> — which
                is what makes §1 below possible at all. No transform-animating writer exists outside the
                VisualElement anywhere in the library.
            </p>
            <p class="mt-3 text-sm text-orange-200/80">
                Tip: widen the window to ≥1920px. Automated state: full e2e directory green — this
                tour is the human layer on top.
            </p>
        </header>

        <!-- ═══════════════ 1 · THE HEADLINE ═══════════════ -->
        <section class="rounded-2xl border-2 border-emerald-500/60 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">
                1 · Hover during the glide <span class="text-emerald-400">— NEW</span>
            </h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> your acceptance criterion from
                the #449 sign-off. The global drag lock releases at pointer-up (upstream semantics)
                and the VE composes hover scale WITH the in-flight translate — the exact thing two
                writers could never safely do.
                <strong class="text-orange-300"
                    >Throw the card hard, then hover it mid-glide.</strong
                >
            </p>
            <div class="mt-6 flex justify-center">
                <div
                    class="h-40 w-full max-w-2xl rounded-xl border border-dashed border-slate-600 bg-slate-950 p-4"
                >
                    <motion.div
                        drag="x"
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.95 }}
                        class="flex h-24 w-40 cursor-grab items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-black text-white active:cursor-grabbing"
                        data-testid="glide-card"
                    >
                        THROW ME →
                    </motion.div>
                </div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> while the card is still gliding, hovering
                    it grows it to 1.25× WITHOUT interrupting the glide — scale and travel compose. Un-hovering
                    mid-glide shrinks it back, still gliding.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> hover is ignored until the card stops
                    (the old behavior), the glide snaps/teleports when hover engages, or the card jumps
                    back toward its start.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 2 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">2 · Momentum on the values themselves</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> release animations
                (inertia/settle) drive the axis MotionValues directly — so a bound
                <code>style={'{{ y }}'}</code> value TRACKS the glide live. The readout below is
                <code>y.get()</code> updating during the momentum tail, which used to freeze at the release
                point.
            </p>
            <div class="mt-6 flex items-center gap-8">
                <div
                    class="h-64 w-40 rounded-xl border border-dashed border-slate-600 bg-slate-950 p-3"
                >
                    <motion.div
                        drag="y"
                        style={{ y: glideY }}
                        class="flex h-20 w-32 cursor-grab items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-3xl active:cursor-grabbing"
                        data-testid="momentum-card"
                    >
                        🎢
                    </motion.div>
                </div>
                <div class="rounded-lg bg-slate-950 px-6 py-4 font-mono">
                    <div class="text-xs text-slate-500">bound y MotionValue, live:</div>
                    <div class="text-3xl font-black text-sky-400">{glideReadout}</div>
                </div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> flick the car vertically — the readout
                    keeps counting through the whole glide and settles exactly where the card rests. Grab
                    mid-glide: it freezes instantly under your pointer (velocity-continuous re-grab).
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> the readout freezes at the release point
                    while the card keeps moving, or a mid-glide re-grab teleports.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 3 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">3 · whileDrag is a real priority</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> <code>whileDrag</code> now flips
                <code>setActive('whileDrag')</code> — the animationState owns it, above hover/tap in upstream's
                priority order, with protected keys and structural restore (no more hand-rolled baseline
                math).
            </p>
            <div class="mt-6 flex justify-center">
                <div
                    class="h-44 w-full max-w-2xl rounded-xl border border-dashed border-slate-600 bg-slate-950 p-4"
                >
                    <motion.div
                        drag
                        whileDrag={{ scale: 1.15, rotate: 6, opacity: 0.85 }}
                        whileHover={{ scale: 1.06 }}
                        class="flex h-24 w-40 cursor-grab items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-lg font-black text-white active:cursor-grabbing"
                        data-testid="whiledrag-card"
                    >
                        GRAB ME
                    </motion.div>
                </div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> hover grows it slightly; grabbing
                    chains smoothly into the bigger tilted ghost (whileDrag outranks whileHover); releasing
                    springs back to the hover pose if you're still on it, the rest pose if not — with
                    momentum intact throughout.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> any snap between hover→drag→release poses,
                    the tilt surviving after release, or opacity stuck at 0.85.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 4 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">4 · Authored base survives everything</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> the #401 contract on the new
                writer — an authored channel base (<code>x: 40, rotate: -6</code>) composes with
                drag, survives release-cancellation re-grabs, and is restored by the settle. (Raw
                <code>style="transform:…"</code> STRINGS are the documented upstream-parity exception
                — #458 tracks post-1.x preservation.)
            </p>
            <div class="mt-6 flex justify-center">
                <div
                    class="h-44 w-full max-w-2xl rounded-xl border border-dashed border-slate-600 bg-slate-950 p-4"
                >
                    <motion.div
                        drag
                        dragConstraints={{ left: -80, right: 200, top: -20, bottom: 40 }}
                        style={{ x: 40, rotate: -6 }}
                        class="flex h-24 w-40 cursor-grab items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-lg font-black text-white active:cursor-grabbing"
                        data-testid="authored-card"
                    >
                        TILTED +40px
                    </motion.div>
                </div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> the card starts offset and tilted,
                    keeps its tilt while dragging, bounces off the constraints, and every settle returns
                    it tilted to a constraint-legal spot. Rapid grab-release-grab never loses the tilt
                    or the offset.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> the tilt vanishes during or after a drag,
                    or the card settles un-tilted / at the un-offset origin.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 5 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">5 · whilePan through the same node</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> <code>whilePan</code> (our
                extension — upstream has no pan variant) animates the VisualElement's values via
                <code>animateTarget</code> and restores from the node's own
                <code>baseTarget</code>. Pan anywhere on the pad (it doesn't move — pan is the
                gesture, not the displacement).
            </p>
            <div class="mt-6 flex justify-center">
                <motion.div
                    whilePan={{ scale: 0.97, opacity: 0.7 }}
                    onPanEnd={() => panCount++}
                    class="flex h-32 w-full max-w-2xl cursor-crosshair items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-lg font-bold select-none"
                    data-testid="pan-pad"
                >
                    PAN ACROSS ME — completed pans: {panCount}
                </motion.div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> the pad dims and shrinks slightly
                    for the duration of the pan and restores cleanly on release, every time; the counter
                    ticks per completed pan.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> the pad sticks dim after release, or
                    restore snaps instead of animating.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 6 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">6 · Drag inside layout animations</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> the projection interplay the batch
                had to keep intact — drag + layoutId FLIP now share one writer (the legacy hand-rolled
                FLIP path is deleted; layoutId-without-layout routes through the projection). The deep-dive
                pages below are the signed-off torture tests.
            </p>
            <ol class="mt-4 list-decimal space-y-2 pl-6 text-cyan-300">
                <li>
                    <a class="hover:underline" href="/tests/drag/brutalist-stage"
                        >drag/brutalist-stage</a
                    > — drag + layout + hover composed
                </li>
                <li>
                    <a class="hover:underline" href="/tests/mobile-drawer">mobile-drawer</a> — bound-value
                    drag with layout release
                </li>
                <li>
                    <a class="hover:underline" href="/tests/layout-id">layout-id</a> — the shared-element
                    underline (now projection-driven)
                </li>
                <li>
                    <a class="hover:underline" href="/tests/animate-presence/layout-button"
                        >animate-presence/layout-button</a
                    > — size-corrected releases (the evidenced survivor)
                </li>
                <li>
                    <a class="hover:underline" href="/tests/reorder/basic">reorder/basic</a> — everything
                    at once
                </li>
                <li>
                    <a class="hover:underline" href="/tests/drag/hover-during-glide"
                        >drag/hover-during-glide</a
                    > — §1's automated twin
                </li>
            </ol>
        </section>
    </div>
</div>
