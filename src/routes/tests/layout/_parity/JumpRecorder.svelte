<script lang="ts">
    import { onMount } from 'svelte'
    import { findPop, formatTrace, type Pop, type RecordedFrame } from './jumpTrace'
    import { registerTesterSummary } from './TesterPanel.svelte'

    /**
     * Read-only per-frame recorder that catches one-frame "pops" a human can
     * see but a headless run can't reproduce.
     *
     * When the trigger element is clicked it samples the target's
     * `getBoundingClientRect().top` on every animation frame for
     * `durationMs`, then shows SMOOTH or POP DETECTED (see `findPop` in `jumpTrace.ts`)
     * plus a copyable per-frame trace. It also records the first
     * `durationMs` after it mounts ("page load"), which covers the frames
     * right after "Reset page". Meant to be rendered inside `TesterPanel`,
     * which never mounts under Playwright.
     *
     * @prop targetId Element whose top is sampled (e.g. `b`).
     * @prop triggerId Element whose click starts a recording (e.g. `a`).
     * @prop durationMs How long each recording runs.
     * @prop jumpPx Largest allowed single-frame upward move.
     * @prop earliestSettleMs Earliest time after the click that the target may
     *     reach its settle position (e.g. exit + glide duration).
     */
    let {
        targetId,
        triggerId,
        durationMs = 2000,
        jumpPx = 30,
        earliestSettleMs
    }: {
        targetId: string
        triggerId: string
        durationMs?: number
        jumpPx?: number
        earliestSettleMs: number
    } = $props()

    type Recording = {
        id: number
        kind: 'click' | 'load'
        settleTop: number | null
        frames: RecordedFrame[]
        done: boolean
        pop: Pop | null
    }

    let recordings = $state<Recording[]>([])
    let traceElement = $state<HTMLPreElement | null>(null)
    let copied = $state(false)

    const latest = $derived(recordings[0] ?? null)
    const latestClick = $derived(recordings.find((run) => run.kind === 'click') ?? null)

    const environment = () =>
        `viewport ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x · ${navigator.userAgent}`

    const describe = (run: Recording) => {
        const title =
            run.kind === 'click'
                ? `click #${triggerId} → #${targetId} top · settle ${run.settleTop?.toFixed(1)} · glide may reach it at ~${earliestSettleMs}ms`
                : `page load → #${targetId} top (first frame after the tester panel mounted)`
        const verdict = !run.done
            ? 'RECORDING'
            : run.pop
              ? `POP DETECTED at frame #${run.pop.frame} (+${Math.round(run.pop.t)} ms): ${run.pop.reason}`
              : 'SMOOTH'
        return `${title}\n${verdict}\n${environment()}\n${formatTrace(run.frames, triggerId)}`
    }

    onMount(() => {
        let nextId = 1
        // Latest pending frame per recording id (plain object: not UI state).
        const loops: Record<number, number> = {}

        const topOf = () => document.getElementById(targetId)?.getBoundingClientRect().top ?? null
        const triggerPresent = () => document.getElementById(triggerId) !== null

        const record = (kind: Recording['kind'], settleTop: number | null) => {
            const start = performance.now()
            const frames: RecordedFrame[] = [{ t: 0, top: topOf(), trigger: triggerPresent() }]
            const run: Recording = { id: nextId++, kind, settleTop, frames, done: false, pop: null }
            recordings = [run, ...recordings].slice(0, 4)
            copied = false
            const step = () => {
                const t = performance.now() - start
                frames.push({ t, top: topOf(), trigger: triggerPresent() })
                if (t < durationMs) {
                    loops[run.id] = requestAnimationFrame(step)
                    return
                }
                const finalTop = [...frames].reverse().find((frame) => frame.top !== null)?.top
                const pop =
                    kind === 'click'
                        ? findPop(frames, { jumpPx, settleTop, earliestSettleMs })
                        : // On load nothing should glide: the target must never be
                          // drawn above where it finally rests.
                          findPop(frames, {
                              jumpPx,
                              settleTop: finalTop == null ? null : finalTop - 1,
                              earliestSettleMs: durationMs + 1
                          })
                recordings = recordings.map((existing) =>
                    existing.id === run.id
                        ? { ...run, frames: [...frames], done: true, pop }
                        : existing
                )
            }
            loops[run.id] = requestAnimationFrame(step)
        }

        // Capture phase: runs before the fixture's own click handler, so
        // frame 0 is the pre-click state and the trigger is still in place.
        const onClick = (event: MouseEvent) => {
            const trigger = (event.target as Element | null)?.closest?.(`#${triggerId}`)
            if (!trigger) return
            record('click', trigger.getBoundingClientRect().top)
        }
        document.addEventListener('click', onClick, true)
        record('load', null)

        return () => {
            document.removeEventListener('click', onClick, true)
            for (const handle of Object.values(loops)) cancelAnimationFrame(handle)
        }
    })

    const selectTrace = () => {
        if (!traceElement) return
        const range = document.createRange()
        range.selectNodeContents(traceElement)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
    }

    const copyTrace = async () => {
        if (!latest) return
        try {
            await navigator.clipboard.writeText(describe(latest))
            copied = true
        } catch {
            selectTrace()
        }
    }

    registerTesterSummary(compactSummary)
</script>

{#snippet chip(run: Recording | null)}
    {#if !run}
        <span class="chip idle">NOT RECORDED YET</span>
    {:else if !run.done}
        <span class="chip idle">RECORDING…</span>
    {:else if run.pop}
        <span class="chip pop">POP DETECTED</span>
    {:else}
        <span class="chip smooth">SMOOTH</span>
    {/if}
{/snippet}

{#snippet compactSummary()}
    <p class="compact">
        {@render chip(latestClick)}
        <span>
            {#if latestClick?.done && latestClick.pop}
                frame #{latestClick.pop.frame} (+{Math.round(latestClick.pop.t)} ms)
            {:else if latestClick?.done}
                last click on #{triggerId}: no pop
            {:else if latestClick}
                watching #{targetId}…
            {:else}
                click the red box to record
            {/if}
        </span>
    </p>
{/snippet}

<div class="recorder" aria-label="Pop recorder">
    <p class="intro">
        Records #{targetId}’s position on every frame for {durationMs / 1000} s after you click #{triggerId},
        and for {durationMs / 1000} s after the page loads (so it also watches right after “Reset page”).
    </p>

    {#if recordings.length === 0}
        <p class="empty">Waiting for the first frame…</p>
    {:else}
        <ul>
            {#each recordings as run (run.id)}
                <li>
                    {@render chip(run)}
                    <span class="detail">
                        <b>{run.kind === 'click' ? `After clicking #${triggerId}` : 'Page load'}</b>
                        · {run.frames.length} frames
                        {#if run.done && run.pop}
                            <br />Frame #{run.pop.frame} (+{Math.round(run.pop.t)} ms): {run.pop
                                .reason}
                        {/if}
                    </span>
                </li>
            {/each}
        </ul>
    {/if}

    {#if latest?.done}
        <div class="trace-head">
            <h3>Frame trace ({latest.kind === 'click' ? `click #${triggerId}` : 'page load'})</h3>
            <div class="trace-actions">
                <button type="button" onclick={selectTrace}>Select</button>
                <button type="button" onclick={copyTrace}>{copied ? 'Copied ✓' : 'Copy'}</button>
            </div>
        </div>
        <pre bind:this={traceElement}>{describe(latest)}</pre>
        <p class="note">
            Please copy this trace and send it to us if you see a pop. Each line is a run of frames
            with the same top; “{triggerId}” means #{triggerId} was still in the page.
        </p>
    {/if}
    <p class="note">
        POP DETECTED = #{targetId} moved up more than {jumpPx} px in a single frame, or reached its final
        spot before the glide could have got there (~{earliestSettleMs} ms after the click). Note: frames
        drawn before the page’s script starts can’t be recorded.
    </p>
</div>

<style>
    .intro,
    .empty,
    .note {
        margin: 0 0 8px;
        font-size: 11px;
        color: #647185;
    }
    ul {
        list-style: none;
        margin: 0 0 10px;
        padding: 0;
    }
    li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 6px 0;
        border-top: 1px solid #eef1f5;
        font-size: 12px;
        color: #43536a;
    }
    .chip {
        flex-shrink: 0;
        padding: 1px 8px;
        border-radius: 999px;
        font:
            700 10px/1.6 ui-monospace,
            monospace;
        color: #fff;
    }
    .chip.smooth {
        background: #16724c;
    }
    .chip.pop {
        background: #b42318;
    }
    .chip.idle {
        background: #647185;
    }
    .compact {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 0;
        font-size: 12px;
        color: #43536a;
    }
    .trace-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
    }
    h3 {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        color: #556275;
    }
    .trace-actions {
        display: flex;
        gap: 6px;
    }
    button {
        font:
            600 11px/1.4 system-ui,
            sans-serif;
        border: 1px solid #ccd6e2;
        border-radius: 6px;
        padding: 3px 10px;
        background: #fff;
        color: #34465d;
        cursor: pointer;
    }
    button:hover {
        background: #f0f4f8;
    }
    pre {
        max-height: 220px;
        overflow: auto;
        margin: 0 0 8px;
        padding: 8px 10px;
        border: 1px solid #e6ebf0;
        border-radius: 8px;
        background: #f8fafc;
        font:
            11px/1.45 ui-monospace,
            SFMono-Regular,
            monospace;
        color: #26364b;
        white-space: pre;
        user-select: text;
        -webkit-user-select: text;
    }
</style>
