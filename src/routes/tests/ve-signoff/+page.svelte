<script lang="ts">
    import {
        motion,
        AnimatePresence,
        MotionConfig,
        useAnimationControls,
        type ReducedMotionConfig
    } from '$lib'
    import { page as pageState } from '$app/state'

    // §1 enter/replay
    let enterKey = $state(0)

    // §2 variant tree + stagger
    let stackOpen = $state(false)
    const stackVariants = {
        closed: { opacity: 0, y: 24, scale: 0.9 },
        open: { opacity: 1, y: 0, scale: 1 }
    }

    // §4 imperative controls
    const controls = useAnimationControls()
    let controlsAtEnd = $state(false)
    const controlsStart = () => {
        void controls.start(
            { x: controlsAtEnd ? 0 : 420, rotate: controlsAtEnd ? 0 : 360 },
            {
                duration: 2.5,
                ease: 'easeInOut'
            }
        )
        controlsAtEnd = !controlsAtEnd
    }

    // §5 rolling label
    const stages = ['DRAFT', 'REVIEW', 'APPROVED', 'SHIPPED'] as const
    let stageIndex = $state(0)
    const stage = $derived(stages[stageIndex])

    // §6 reduced motion — policy survives refresh via the ?rm= URL param
    // (app state, not browser form restoration), so "refresh with always"
    // is a REAL first-paint test: the box's enter runs under the policy.
    // Read via $app/state so SSR sees the SAME policy as the client — a
    // window-guarded read renders the server under 'never' and hydrates the
    // client under 'always', a mismatch this page must not create.
    const initialPolicy = ((): ReducedMotionConfig => {
        const p = pageState.url.searchParams.get('rm')
        return p === 'always' || p === 'user' ? p : 'never'
    })()
    let rmPolicy = $state<ReducedMotionConfig>(initialPolicy)
    // Adopt any browser-restored radio state after hydration, so the checked
    // radio and the MotionConfig policy can never disagree on refresh…
    $effect(() => {
        const restored = document.querySelector<HTMLInputElement>('input[name="rm-policy"]:checked')
        if (restored && restored.value !== rmPolicy) {
            rmPolicy = restored.value as ReducedMotionConfig
        }
    })
    // …and mirror the policy into the URL so a refresh keeps it honestly.
    $effect(() => {
        const url = new URL(window.location.href)
        if (rmPolicy === 'never') url.searchParams.delete('rm')
        else url.searchParams.set('rm', rmPolicy)
        history.replaceState(null, '', url)
    })
</script>

<div class="min-h-screen bg-[#0b0d12] px-6 py-10 text-slate-200">
    <div class="mx-auto max-w-4xl space-y-16">
        <!-- ═══════════════ BANNER ═══════════════ -->
        <header class="rounded-2xl border-2 border-amber-400 bg-amber-400/10 p-8">
            <p class="text-sm font-bold tracking-widest text-amber-400">
                SIGN-OFF TOUR · ISSUE #449
            </p>
            <h1 class="mt-2 text-4xl font-black text-white">VisualElement Core Migration</h1>
            <p class="mt-4 max-w-3xl text-lg leading-relaxed">
                Every animation on this page — enter, variants, gestures, imperative controls, exit
                — now runs through <strong class="text-amber-300"
                    >one motion-dom VisualElement + createAnimationState per element</strong
                >, replacing six independent writer systems. Drag is the one deliberate exception
                (plan 005, deferred). Work each section top to bottom; every section says what it
                exercises, what PASS looks like, and what a FAILURE would look like.
            </p>
            <p class="mt-3 text-sm text-amber-200/80">
                Tip: widen the window to ≥1920px. Automated state: 377/377 e2e green — this tour is
                the human layer on top.
            </p>
        </header>

        <!-- ═══════════════ 1 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">1 · The new core: enter animation</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> the plan-002 writer swap —
                <code>initial</code>→<code>animate</code> resolved by
                <code>animationState.animateChanges()</code>, rendered per-frame from
                <code>latestValues</code>. Replay remounts the element (also touching the plan-004
                key-change path).
            </p>
            <div class="mt-6 flex items-center gap-8">
                {#key enterKey}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.7, rotate: -8 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                        class="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-4xl"
                        data-testid="enter-box"
                    >
                        🚀
                    </motion.div>
                {/key}
                <button
                    class="rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500"
                    onclick={() => enterKey++}
                >
                    Replay enter
                </button>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> rocket rises, un-tilts and fades in
                    as ONE smooth motion, every replay identical. It rests exactly upright at full opacity.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> a flash at full opacity before the animation
                    starts, a double-run, or a visible “pop” at the end when the animation settles.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 2 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">2 · Variant tree + stagger</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> parent variant labels propagating
                through the VisualElement tree (plan-002 Step 5 — children inherit via
                <code>getVariantContext</code>, staggered by the parent's transition).
            </p>
            <div class="mt-6">
                <button
                    class="rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-500"
                    onclick={() => (stackOpen = !stackOpen)}
                >
                    {stackOpen ? 'Collapse' : 'Expand'} stack
                </button>
                <motion.div
                    animate={stackOpen ? 'open' : 'closed'}
                    initial="closed"
                    class="mt-4 flex gap-3"
                >
                    {#each ['🔔', '💬', '📦', '⭐', '🎯'] as icon, i (i)}
                        <motion.div
                            variants={stackVariants}
                            transition={{ duration: 0.35, delay: stackOpen ? i * 0.08 : 0 }}
                            class="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-700 text-2xl"
                        >
                            {icon}
                        </motion.div>
                    {/each}
                </motion.div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> children rise in one after another,
                    left to right (visible stagger). The FIRST click animates — it doesn't jump. Collapse
                    animates everything back down together.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> children snap instantly on the first
                    click (the “swallowed first pass” bug), all move at once with no stagger, or some
                    children never move.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 3 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">3 · Gesture priority + velocity handoff</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> plan 003 — hover and tap are now
                just <code>setActive('whileHover'|'whileTap')</code>; the animationState retargets
                the SAME motion values, so momentum carries across every transition. The old
                hand-tuned coordinator is deleted; this is the structural replacement.
                <strong class="text-amber-300">MASH IT:</strong> hover in/out rapidly, press-and-release
                mid-hover, drag the cursor off while pressed.
            </p>
            <div class="mt-6 flex justify-center">
                <motion.div
                    whileHover={{ scale: 1.18, y: -10 }}
                    whileTap={{ scale: 0.82, y: 2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    class="flex h-32 w-64 cursor-pointer select-none items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-xl font-black text-white"
                    data-testid="gesture-box"
                >
                    HOVER · PRESS · MASH
                </motion.div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> every state change flows through the
                    current position with spring momentum — hover→press→release→ unhover chains feel like
                    one continuous physical object. No frame ever teleports.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> any visible snap — especially releasing
                    a press while the hover-grow is mid-flight, or un-hovering during the release spring.
                    A snap there means two writers are fighting.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 4 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">4 · Imperative controls: stop = freeze</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> plan-002 Step 7 —
                <code>useAnimationControls()</code> drives the same VisualElement via
                <code>animateVisualElement</code>; <code>stop()</code> samples the WAAPI animation
                for value + velocity (motion-dom's own freeze machinery).
                <strong class="text-amber-300">Start alternates direction</strong> — first click slides
                right with a +360° spin, the next slides back left — so after a mid-flight Stop, the next
                Start heads for the OTHER end, from the frozen pose. Sequence: Start → Stop mid-flight
                → watch ~2s → Start again.
            </p>
            <div class="mt-6">
                <div class="flex gap-3">
                    <button
                        class="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500"
                        onclick={controlsStart}
                    >
                        Start slide {controlsAtEnd ? '← back' : '→ out'}
                    </button>
                    <button
                        class="rounded-lg bg-slate-600 px-5 py-2.5 font-semibold text-white hover:bg-slate-500"
                        onclick={() => controls.stop()}
                    >
                        Stop (freeze)
                    </button>
                </div>
                <div class="mt-4 h-24 rounded-xl border border-slate-700 bg-slate-950 p-4">
                    <motion.div
                        animate={controls}
                        class="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-2xl"
                        data-testid="controls-box"
                    >
                        🎛️
                    </motion.div>
                </div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> Stop freezes the box EXACTLY where
                    it is, mid-rotation and all — and it STAYS there (watch ~2s). The next Start continues
                    smoothly from the frozen pose toward the opposite end (per the alternating direction).
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> the box snaps to either end on Stop,
                    drifts back to the start a moment after freezing (the “reset-on-rerender” bug we fixed),
                    or the next Start teleports first.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 5 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">5 · Exit + wait-mode rolling label</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> plan 004 — the key-change exit
                runs through <code>setActive('exit')</code> with real presence context; the enter waits
                for the exit (mode="wait"). These were the two red specs the batch closed last.
            </p>
            <div class="mt-6 flex items-center gap-6">
                <div class="relative h-14 w-44 overflow-visible">
                    <AnimatePresence mode="wait" initial={false}>
                        {#key stage}
                            <motion.div
                                key={stage}
                                initial={{ opacity: 0, y: 14, filter: 'blur(5px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -14, filter: 'blur(5px)' }}
                                transition={{ duration: 0.3 }}
                                class="absolute inset-0 flex items-center justify-center rounded-lg bg-cyan-500 font-black tracking-wider text-slate-950"
                                data-testid="stage-label"
                            >
                                {stage}
                            </motion.div>
                        {/key}
                    </AnimatePresence>
                </div>
                <button
                    class="rounded-lg bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500"
                    onclick={() => (stageIndex = (stageIndex + 1) % stages.length)}
                >
                    Advance stage
                </button>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> old label blurs UP and out, THEN the
                    new one blurs in from below — strict sequence, every click, including rapid clicking.
                    The label always ends crisp and fully opaque.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> the new label appears while the old is
                    still leaving, a label gets STUCK blurred/faded (the exit landing after the enter
                    — the exact bug 004 fixed), or rapid clicks wedge it.
                </p>
            </div>
        </section>

        <!-- ═══════════════ 6 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">6 · Reduced-motion policy</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> the re-homed reduced-motion
                filter (plan-002 3h) — under <code>always</code>, transform channels are stripped
                BEFORE the animationState sees them; opacity still animates. This section had the
                “double-fade” bug we caught frame-by-frame.
            </p>
            <div class="mt-6">
                <div class="flex gap-4">
                    {#each ['never', 'always'] as const as option (option)}
                        <label class="flex cursor-pointer items-center gap-2">
                            <!-- autocomplete="off" + the mount sync below defeat browser
                                 form-state restoration on refresh: Chrome re-checks the
                                 last-selected radio WITHOUT an input event, so the visible
                                 radio and Svelte state can disagree (checked "always",
                                 state 'never' → the box slides and looks like a lib bug). -->
                            <input
                                type="radio"
                                name="rm-policy"
                                autocomplete="off"
                                bind:group={rmPolicy}
                                value={option}
                            />
                            <span class="font-mono text-sm">{option}</span>
                        </label>
                    {/each}
                </div>
                <p class="mt-1 text-xs text-slate-500">
                    Active policy: <strong class="font-mono text-slate-300">{rmPolicy}</strong>
                    — mirrored into the URL (<code>?rm=…</code>), so a refresh keeps it as REAL app
                    state. If a radio ever looks checked while this label disagrees, that's browser
                    form restoration, not the library.
                </p>
                <p class="mt-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm">
                    <strong class="text-sky-400">REFRESH TEST (first-paint policy):</strong>
                    select <code>always</code>, then hit refresh — the URL keeps
                    <code>?rm=always</code> and the box's ENTER animation itself runs under the
                    policy. PASS: it fades in exactly where it sits, zero horizontal movement. FAIL:
                    any slide on load while the Active-policy label says
                    <code>always</code>.
                </p>
                <MotionConfig reducedMotion={rmPolicy}>
                    {#key rmPolicy}
                        <motion.div
                            initial={{ opacity: 0, x: -160 }}
                            animate={{ opacity: 1, x: 160 }}
                            transition={{ duration: 1.1, ease: 'easeOut' }}
                            class="mt-4 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 text-3xl"
                            data-testid="rm-box"
                        >
                            🎚️
                        </motion.div>
                    {/key}
                </MotionConfig>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> on <code>never</code> the box
                    slides AND fades. On <code>always</code> it stays put and ONLY fades — exactly one
                    fade, then rock-solid at full opacity.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> under <code>always</code> the box slides,
                    or the fade completes and then RE-RUNS from transparent (the double-fade flash).
                </p>
            </div>
        </section>

        <!-- ═══════════════ 7 ═══════════════ -->
        <section class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-3xl font-black text-white">7 · Drag ↔ gesture bridge</h2>
            <p class="mt-2 text-slate-400">
                <strong class="text-slate-200">Exercises:</strong> the one seam left on purpose — drag
                still writes transforms itself (plan 005 deferred), and plan 003 added a bridge so VisualElement
                renders never wipe a settled drag position. Drag the box somewhere, let go, then hover
                on/off it repeatedly.
            </p>
            <div class="mt-6 flex justify-center">
                <div
                    class="relative h-56 w-full max-w-xl rounded-xl border-2 border-dashed border-slate-600 bg-slate-950"
                >
                    <motion.div
                        drag
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        class="absolute left-4 top-4 flex h-20 w-20 cursor-grab items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-3xl active:cursor-grabbing"
                        data-testid="drag-box"
                    >
                        🧲
                    </motion.div>
                </div>
            </div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
                <p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <strong class="text-emerald-400">PASS:</strong> after dragging and releasing, the
                    box STAYS where you left it through any amount of hover-grow / hover-shrink (once
                    it is AT REST). Momentum toss still glides and settles.
                </p>
                <p class="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
                    <strong class="text-rose-400">FAIL:</strong> the box jumps back toward its start corner
                    when a hover ends (the settled-translate wipe the bridge exists to prevent).
                </p>
                <p
                    class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm md:col-span-2"
                >
                    <strong class="text-amber-400">KNOWN (plan 005):</strong> hover does NOT respond while
                    the box is moving — during the drag itself (upstream-correct: framer suppresses it
                    too) AND during the post-release glide (stricter than upstream, deliberate: two writers
                    can't safely share the transform until the drag writer moves onto the VisualElement).
                    Hover-during-glide is now a named acceptance criterion in plan 005.
                </p>
            </div>
        </section>

        <!-- ═══════════════ NEXT STOPS ═══════════════ -->
        <footer class="rounded-2xl border border-slate-700 bg-slate-900/60 p-8">
            <h2 class="text-2xl font-black text-white">Deep-dive pages (in review order)</h2>
            <p class="mt-2 text-sm text-slate-400">
                Once this page passes, these are the production-grade versions of each behavior —
                the pages the e2e suites actually pin:
            </p>
            <ol class="mt-4 list-decimal space-y-2 pl-6 text-cyan-300">
                <li>
                    <a class="hover:underline" href="/tests/variants/notifications-stack"
                        >variants/notifications-stack</a
                    > — the full stagger/inheritance dogfood
                </li>
                <li>
                    <a class="hover:underline" href="/tests/animate-presence/layout-button"
                        >animate-presence/layout-button</a
                    > — the rolling-copy control (the batch's last two red specs)
                </li>
                <li>
                    <a class="hover:underline" href="/tests/animation-controls"
                        >animation-controls</a
                    > — start/stop/re-attach torture page
                </li>
                <li>
                    <a class="hover:underline" href="/tests/motion-config-reduced-motion"
                        >motion-config-reduced-motion</a
                    > — the policy matrix
                </li>
                <li>
                    <a class="hover:underline" href="/tests/drag/brutalist-stage"
                        >drag/brutalist-stage</a
                    >
                    + <a class="hover:underline" href="/tests/mobile-drawer">mobile-drawer</a> — signed-off
                    drag interop
                </li>
                <li>
                    <a class="hover:underline" href="/tests/reorder/basic">reorder/basic</a> — drag +
                    layout + presence composed
                </li>
            </ol>
        </footer>
    </div>
</div>
