<script lang="ts">
    import { onMount, tick } from 'svelte'
    import { motion, AnimatePresence, MotionConfig } from '$lib'

    let isVisible = $state(true)
    let scrollX = $state(0)
    let scrollY = $state(0)
    let boxCount = $state(0)
    let cloneCount = $state(0)
    let scrollHost: HTMLDivElement | undefined = $state()
    let diagnostics = $state({
        box: 'missing',
        clone: 'missing',
        cloneDelta: 'n/a',
        cloneStyle: 'n/a',
        host: 'n/a',
        placeholder: 'missing',
        stage: 'n/a',
        viewport: 'n/a'
    })
    let lastLiveBoxRect = $state<DOMRect | null>(null)

    function formatRect(rect: DOMRect | null) {
        if (!rect) return 'missing'

        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        return `x ${Math.round(rect.left)} y ${Math.round(rect.top)} w ${Math.round(rect.width)} h ${Math.round(rect.height)} cx ${Math.round(centerX)} cy ${Math.round(centerY)}`
    }

    function formatDelta(a: DOMRect | null, b: DOMRect | null) {
        if (!a || !b) return 'n/a'

        const aCenterX = a.left + a.width / 2
        const aCenterY = a.top + a.height / 2
        const bCenterX = b.left + b.width / 2
        const bCenterY = b.top + b.height / 2

        return `dx ${Math.round(aCenterX - bCenterX)} dy ${Math.round(aCenterY - bCenterY)}`
    }

    function toggleVisibility() {
        isVisible = !isVisible
        scheduleDomStateRead()
    }

    function readDomState() {
        if (typeof document === 'undefined') return
        const liveBox = document.querySelector('[data-testid="box"]:not([data-clone="true"])')
        const clone = document.querySelector('[data-clone="true"]')
        const placeholder = document.querySelector('[data-presence-placeholder="true"]')
        const stage = document.querySelector('[data-testid="stage"]')
        const liveRect = liveBox?.getBoundingClientRect() ?? null
        const cloneRect = clone?.getBoundingClientRect() ?? null
        const placeholderRect = placeholder?.getBoundingClientRect() ?? null
        const stageRect = stage?.getBoundingClientRect() ?? null
        const cloneStyle = clone ? getComputedStyle(clone) : null

        if (liveRect) {
            lastLiveBoxRect = liveRect
        }

        scrollX = Math.round(scrollHost?.scrollLeft ?? window.scrollX)
        scrollY = Math.round(scrollHost?.scrollTop ?? window.scrollY)
        boxCount = document.querySelectorAll('[data-testid="box"]:not([data-clone="true"])').length
        cloneCount = document.querySelectorAll('[data-clone="true"]').length
        diagnostics = {
            box: formatRect(liveRect),
            clone: formatRect(cloneRect),
            cloneDelta: formatDelta(cloneRect, liveRect ?? lastLiveBoxRect),
            cloneStyle: cloneStyle
                ? `${cloneStyle.position} top ${Math.round(parseFloat(cloneStyle.top) || 0)} left ${Math.round(parseFloat(cloneStyle.left) || 0)} z ${cloneStyle.zIndex}`
                : 'n/a',
            host: scrollHost
                ? `left ${Math.round(scrollHost.scrollLeft)} top ${Math.round(scrollHost.scrollTop)} w ${scrollHost.clientWidth}/${scrollHost.scrollWidth} h ${scrollHost.clientHeight}/${scrollHost.scrollHeight}`
                : `window left ${Math.round(window.scrollX)} top ${Math.round(window.scrollY)}`,
            placeholder: formatRect(placeholderRect),
            stage: formatRect(stageRect),
            viewport: `${window.innerWidth} x ${window.innerHeight}`
        }
    }

    function scheduleDomStateRead() {
        void tick().then(() => {
            readDomState()
            requestAnimationFrame(() => {
                readDomState()
                setTimeout(readDomState, 40)
            })
        })
    }

    function scrollByPage(delta: number) {
        const target = scrollHost ?? window
        target.scrollBy({ top: delta, behavior: 'smooth' })
        scheduleDomStateRead()
    }

    function scrollByPageX(delta: number) {
        const target = scrollHost ?? window
        target.scrollBy({ left: delta, behavior: 'smooth' })
        scheduleDomStateRead()
    }

    function hideAndScroll() {
        if (!isVisible) {
            isVisible = true
            scheduleDomStateRead()
            return
        }

        isVisible = false
        scheduleDomStateRead()
        requestAnimationFrame(() => {
            const target = scrollHost ?? window
            target.scrollBy({ top: 420, behavior: 'smooth' })
            scheduleDomStateRead()
        })
    }

    function hideAndScrollRight() {
        if (!isVisible) {
            isVisible = true
            scheduleDomStateRead()
            return
        }

        isVisible = false
        scheduleDomStateRead()
        requestAnimationFrame(() => {
            const target = scrollHost ?? window
            target.scrollBy({ left: 520, behavior: 'smooth' })
            scheduleDomStateRead()
        })
    }

    const isPlaywright =
        typeof window !== 'undefined' && window.location.search.includes('@isPlaywright=true')

    // Keep the Playwright path deterministic for the existing timing specs.
    const demoTransition = isPlaywright
        ? { duration: 1 }
        : { type: 'spring' as const, stiffness: 300, damping: 25 }

    onMount(() => {
        readDomState()
        const interval = window.setInterval(readDomState, 80)
        window.addEventListener('scroll', readDomState, { passive: true })
        scrollHost?.addEventListener('scroll', readDomState, { passive: true })

        return () => {
            window.clearInterval(interval)
            window.removeEventListener('scroll', readDomState)
            scrollHost?.removeEventListener('scroll', readDomState)
        }
    })
</script>

<div
    bind:this={scrollHost}
    class="h-screen overflow-auto bg-[#050808] text-white"
    data-testid="scroll-host"
>
    <div
        class="mx-auto flex min-h-[130vh] w-[1800px] max-w-none flex-col items-center justify-center gap-10 px-6 py-24"
    >
        <div
            class="grid grid-cols-4 gap-3 text-center font-mono text-xs tracking-[0.18em] text-white/60 uppercase"
            data-testid="counters"
        >
            <div class="rounded border border-white/10 px-3 py-2">
                scroll x
                <strong class="block text-base tracking-normal text-white">{scrollX}</strong>
            </div>
            <div class="rounded border border-white/10 px-3 py-2">
                scroll y
                <strong class="block text-base tracking-normal text-white">{scrollY}</strong>
            </div>
            <div class="rounded border border-white/10 px-3 py-2">
                boxes
                <strong class="block text-base tracking-normal text-white">{boxCount}</strong>
            </div>
            <div class="rounded border border-white/10 px-3 py-2">
                clones
                <strong class="block text-base tracking-normal text-white">{cloneCount}</strong>
            </div>
        </div>

        <div class="relative flex h-56 w-32 flex-col items-center" data-testid="stage">
            <MotionConfig transition={{ duration: 0.6 }}>
                <div class="flex h-32 items-center justify-center">
                    <AnimatePresence initial={!isPlaywright}>
                        {#if isVisible}
                            <motion.div
                                key="box"
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={demoTransition}
                                class="flex size-32 items-center justify-center rounded-2xl bg-cyan-400 font-mono text-xl font-semibold text-gray-900"
                                data-testid="box"
                            >
                                Hello
                            </motion.div>
                        {/if}
                    </AnimatePresence>
                </div>

                <motion.button
                    onclick={toggleVisibility}
                    whileTap={{ y: 1 }}
                    class="absolute right-0 bottom-0 left-0 cursor-pointer rounded-lg border-none bg-cyan-400 px-5 py-2.5 text-gray-900 hover:bg-cyan-500"
                    data-testid="toggle"
                >
                    {isVisible ? 'Hide' : 'Show'}
                </motion.button>
            </MotionConfig>
        </div>

        <div class="flex flex-wrap justify-center gap-3" data-testid="controls">
            <button
                type="button"
                class="rounded border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                onclick={() => scrollByPage(-360)}
                data-testid="scroll-up"
            >
                Scroll up
            </button>
            <button
                type="button"
                class="rounded border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                onclick={() => scrollByPage(360)}
                data-testid="scroll-down"
            >
                Scroll down
            </button>
            <button
                type="button"
                class="rounded border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                onclick={() => scrollByPageX(-520)}
                data-testid="scroll-left"
            >
                Scroll left
            </button>
            <button
                type="button"
                class="rounded border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                onclick={() => scrollByPageX(520)}
                data-testid="scroll-right"
            >
                Scroll right
            </button>
            <button
                type="button"
                class="rounded bg-cyan-400 px-3 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-300"
                onclick={hideAndScroll}
                data-testid="hide-and-scroll"
            >
                {isVisible ? 'Hide + scroll' : 'Show'}
            </button>
            <button
                type="button"
                class="rounded bg-cyan-400 px-3 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-300"
                onclick={hideAndScrollRight}
                data-testid="hide-and-scroll-right"
            >
                {isVisible ? 'Hide + scroll right' : 'Show'}
            </button>
        </div>

        <p class="font-mono text-lg text-white/75" data-testid="state-label">
            State: <strong class="text-white">{isVisible ? 'visible' : 'hidden'}</strong>
        </p>

        <div
            class="grid w-full max-w-3xl gap-2 rounded border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-white/65"
            data-testid="diagnostics"
        >
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">host</span>
                <span>{diagnostics.host}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">viewport</span>
                <span>{diagnostics.viewport}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">stage</span>
                <span>{diagnostics.stage}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">box</span>
                <span>{diagnostics.box}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">clone</span>
                <span>{diagnostics.clone}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">delta</span>
                <span>{diagnostics.cloneDelta}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">clone css</span>
                <span>{diagnostics.cloneStyle}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-2">
                <span class="text-white/35 uppercase">placeholder</span>
                <span>{diagnostics.placeholder}</span>
            </div>
        </div>
    </div>

    <div class="mx-auto h-screen w-[1800px] max-w-none border-t border-b border-white/10"></div>
</div>
