<script lang="ts">
    import { AnimatePresence, motion, styleString } from '@humanspeak/svelte-motion'

    // A fixed 3-column "processing strip". Every card has `layout` plus
    // enter/exit animations inside `<AnimatePresence>`: completing a job
    // fades its card out IN PLACE (sync mode holds the grid slot until the
    // exit finishes), then the survivors FLIP smoothly into the freed
    // column — no snapping, no double jumps.
    type Job = {
        id: number
        name: string
        rows: number
        startedAt: number
    }

    const JOB_NAMES = [
        'cdc.inv_transaction',
        'sync.orders_v2',
        'ingest.users',
        'etl.payments',
        'index.search_docs',
        'vacuum.analytics'
    ]

    const MAX_SLOTS = 3

    let nextId = 0
    let now = $state(Date.now())

    const spawnJob = (): Job => ({
        id: nextId++,
        name: JOB_NAMES[nextId % JOB_NAMES.length],
        rows: 12_000 + Math.floor(Math.random() * 90_000),
        startedAt: Date.now()
    })

    let jobs = $state<Job[]>([spawnJob(), spawnJob(), spawnJob()])

    // Live row counters + elapsed clocks make the strip feel like real work.
    $effect(() => {
        const tick = setInterval(() => {
            now = Date.now()
            for (const job of jobs) {
                job.rows += 800 + Math.floor(Math.random() * 4200)
            }
        }, 1000)
        return () => clearInterval(tick)
    })

    const complete = (id: number) => {
        jobs = jobs.filter((job) => job.id !== id)
    }

    const enqueue = () => {
        if (jobs.length < MAX_SLOTS) {
            jobs = [...jobs, spawnJob()]
        }
    }

    const elapsed = (job: Job): string => {
        const seconds = Math.max(0, Math.floor((now - job.startedAt) / 1000))
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// processing queue</span>
            <span class="micro counter">
                {String(jobs.length).padStart(2, '0')} / {String(MAX_SLOTS).padStart(2, '0')} slots
            </span>
        </div>

        <div class="stage">
            {#if jobs.length === 0}
                <div class="empty">
                    <span class="micro">// idle — queue drained</span>
                </div>
            {:else}
                <div class="grid">
                    <AnimatePresence>
                        {#each jobs as job (job.id)}
                            <motion.div
                                key={job.id}
                                layout
                                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -14, scale: 0.96 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                style={styleString(() => ({
                                    height: '100%',
                                    minWidth: 0
                                }))}
                            >
                                <article class="card">
                                    <header class="card-head">
                                        <motion.span
                                            animate={{ opacity: [1, 0.35, 1] }}
                                            transition={{
                                                duration: 1.6,
                                                repeat: Infinity,
                                                ease: 'easeInOut'
                                            }}
                                            style={styleString(() => ({
                                                flex: 'none',
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--brut-accent, #247768)'
                                            }))}
                                        ></motion.span>
                                        <span class="name">{job.name}</span>
                                        <motion.button
                                            aria-label={`complete ${job.name}`}
                                            onclick={() => complete(job.id)}
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.85 }}
                                            style={styleString(() => ({
                                                marginLeft: 'auto',
                                                flex: 'none',
                                                border: '1px solid var(--brut-rule-2, #bbc4c0)',
                                                backgroundColor: 'transparent',
                                                color: 'var(--brut-ink-2, #525252)',
                                                fontSize: '0.6875rem',
                                                lineHeight: 1,
                                                width: '1.25rem',
                                                height: '1.25rem',
                                                cursor: 'pointer'
                                            }))}
                                        >
                                            ✕
                                        </motion.button>
                                    </header>
                                    <dl class="card-meta">
                                        <div>
                                            <dt>rows</dt>
                                            <dd>{job.rows.toLocaleString()}</dd>
                                        </div>
                                        <div>
                                            <dt>elapsed</dt>
                                            <dd>{elapsed(job)}</dd>
                                        </div>
                                    </dl>
                                </article>
                            </motion.div>
                        {/each}
                    </AnimatePresence>
                </div>
            {/if}
        </div>

        <div class="strip-foot">
            <motion.button
                onclick={enqueue}
                disabled={jobs.length >= MAX_SLOTS}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={styleString(() => ({
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--brut-accent, #247768)',
                    backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    padding: '0.5rem 0.875rem',
                    cursor: jobs.length >= MAX_SLOTS ? 'not-allowed' : 'pointer',
                    opacity: jobs.length >= MAX_SLOTS ? 0.4 : 1
                }))}
            >
                + enqueue job
            </motion.button>
            <span class="micro">mode: sync / layout: flip</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 360px;
    }

    .strip {
        width: 100%;
        max-width: 640px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
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

    .counter {
        color: var(--brut-accent, #247768);
    }

    .stage {
        height: 8.5rem;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        height: 100%;
    }

    .empty {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .card {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        padding: 0.75rem;
        min-width: 0;
    }

    .card-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
    }

    .name {
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .card-meta {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0;
    }

    .card-meta div {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .card-meta dt {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .card-meta dd {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        font-variant-numeric: tabular-nums;
        color: var(--brut-ink-2, #525252);
    }
</style>
