<!--
@component
Parity check for Motion 13.4.5 (#3856): AnimatePresence must keep a child
that is added while another child's exit animation is completing.

Upstream React dropped the newly added child when the last in-flight exit
finished during a concurrent transition, because the diffed-children state
was never refreshed from the pending present children. svelte-motion animates
a `data-clone="true"` copy of the leaving element instead of keeping a
rendered-vs-diffed children list, so the React bug should not be possible
here. This page ports upstream's scenario to prove it.

Query params:
- `mode`: `sync` (default) or `popLayout`.
- `timing`: when "D" is added after "B" is removed —
  `exit-complete` (inside `onExitComplete`), `just-before` (290ms, default),
  or `same-tick` (300ms, racing the 300ms exit).

Expected: `#state` reads `ACD` and the rendered `.item` elements are exactly
`item-A`, `item-C`, `item-D`, with D fully opaque and no clone left behind.
-->
<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, MotionDiv } from '$lib/index.js'

    type Mode = 'sync' | 'popLayout'
    type Timing = 'exit-complete' | 'just-before' | 'same-tick'

    const mode: Mode = page.url.searchParams.get('mode') === 'popLayout' ? 'popLayout' : 'sync'

    const timingParam = page.url.searchParams.get('timing')
    const timing: Timing =
        timingParam === 'exit-complete' || timingParam === 'same-tick' ? timingParam : 'just-before'

    const TIMING_DELAY_MS: Record<Exclude<Timing, 'exit-complete'>, number> = {
        'just-before': 290,
        'same-tick': 300
    }

    const initialItems = () => ['A', 'B', 'C']

    let items = $state(initialItems())
    let pendingAddOnExitComplete = false
    let addTimer: ReturnType<typeof setTimeout> | undefined

    const addD = () => {
        if (!items.includes('D')) items = [...items, 'D']
    }

    const remove = () => {
        items = items.filter((id) => id !== 'B')
        if (timing === 'exit-complete') {
            pendingAddOnExitComplete = true
        } else {
            addTimer = setTimeout(addD, TIMING_DELAY_MS[timing])
        }
    }

    const handleExitComplete = () => {
        if (!pendingAddOnExitComplete) return
        pendingAddOnExitComplete = false
        addD()
    }

    const reset = () => {
        clearTimeout(addTimer)
        pendingAddOnExitComplete = false
        items = initialItems()
    }
</script>

<main style="padding: 2rem;">
    <h1>AnimatePresence: add during exit</h1>
    <p>mode: <code>{mode}</code>, timing: <code>{timing}</code></p>
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <button id="remove" onclick={remove}>Remove B, then add D</button>
        <button id="reset" onclick={reset}>Reset</button>
    </div>
    <div id="state">{items.join('')}</div>

    <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <AnimatePresence {mode} initial={false} onExitComplete={handleExitComplete}>
            {#each items as id (id)}
                <MotionDiv
                    key={id}
                    id={`item-${id}`}
                    class="item"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'linear' }}
                    style="width: 100px; height: 100px; background: red;"
                />
            {/each}
        </AnimatePresence>
    </div>
</main>
