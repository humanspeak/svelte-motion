<script lang="ts">
    import { motion } from '$lib/index.js'

    type Heart = {
        id: number
        xOffset: number
        scale: number
    }

    type Circle = {
        id: number
        xOffset: number
        delay: number
        size: number
    }

    let isLiked = $state(false)
    let spawnInterval: ReturnType<typeof setInterval> | null = null
    let hearts = $state<Heart[]>([])
    let circles = $state<Circle[]>([])

    function randomX(): number {
        return Math.floor(Math.random() * 150) - 75
    }

    function spawnBurst(): void {
        const x = randomX()
        const now = Date.now()

        const newHeart: Heart = {
            id: now,
            xOffset: x,
            scale: 0.9 + Math.random() * 0.4
        }

        const newCircles: Circle[] = Array.from({ length: 15 }, (_, i) => ({
            id: now + i + 1,
            delay: i * 0.015,
            size: 16 - i,
            xOffset: x
        }))

        hearts = [...hearts, newHeart]
        circles = [...circles, ...newCircles]

        // Cleanup after animations complete
        setTimeout(() => {
            hearts = hearts.filter((h) => h.id !== newHeart.id)
            const ids = new Set(newCircles.map((c) => c.id))
            circles = circles.filter((c) => !ids.has(c.id))
        }, 2200)
    }

    function startSpawning(): void {
        if (!isLiked) return
        if (spawnInterval) return
        spawnBurst()
        spawnInterval = setInterval(spawnBurst, 120)
    }

    function stopSpawning(): void {
        if (spawnInterval) {
            clearInterval(spawnInterval)
            spawnInterval = null
        }
    }

    function onPointerDown(): void {
        if (!isLiked) {
            isLiked = true
            startSpawning()
        } else {
            // If already liked, pressing again unlikes immediately
            isLiked = false
            stopSpawning()
        }
    }

    function onPointerUp(): void {
        stopSpawning()
    }

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!isLiked) {
                isLiked = true
                startSpawning()
            } else {
                isLiked = false
                stopSpawning()
            }
        }
    }

    const buttonBg = $derived(isLiked ? 'bg-red-500/50' : 'bg-[#2C3A47]')

    function likeInteraction(node: HTMLElement) {
        const handlePointerDown = (e: PointerEvent) => {
            console.log('pointerdown', e)
            onPointerDown()
        }
        const handlePointerUp = (e: PointerEvent) => {
            console.log('pointerup', e)
            onPointerUp()
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            console.log('keydown', e)
            onKeyDown(e)
        }
        node.addEventListener('pointerdown', handlePointerDown)
        node.addEventListener('pointerup', handlePointerUp)
        node.addEventListener('pointercancel', handlePointerUp)
        node.addEventListener('keydown', handleKeyDown)
        return {
            destroy() {
                node.removeEventListener('pointerdown', handlePointerDown)
                node.removeEventListener('pointerup', handlePointerUp)
                node.removeEventListener('pointercancel', handlePointerUp)
                node.removeEventListener('keydown', handleKeyDown)
            }
        }
    }
</script>

<div class="mx-auto flex w-full flex-1 flex-col md:w-1/2">
    <div class="my-2 flex items-center justify-center rounded-3xl bg-[#606B75] px-5 py-3">
        <h3 class="flex-1 pl-5 font-mono font-semibold text-[#1B2224]">Fancy like button</h3>
    </div>
    <div
        class="my-2 flex h-96 flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#505C67] p-5"
    >
        <div
            class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl p-3 pt-20"
        >
            <div class="relative flex" use:likeInteraction>
                <motion.button
                    class={`size-6 ${buttonBg} z-30 flex items-center justify-center rounded-full select-none`}
                    initial={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 400, duration: 0.3 }}
                    aria-pressed={isLiked}
                    role="button"
                    tabindex="0"
                >
                    <i
                        class={`fa-solid fa-heart fa-sm ${isLiked ? 'text-red-500' : 'text-gray-300'}`}
                    ></i>
                </motion.button>
                <!-- Spawn origin centered on the button -->
                <div
                    class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    {#each hearts as heart (heart.id)}
                        <motion.div
                            class="pointer-events-none absolute z-20 flex size-5 items-center justify-center text-red-500/50"
                            initial={{ opacity: 1, x: 0, y: 0, scale: heart.scale }}
                            animate={{ x: heart.xOffset, y: -(heart.xOffset + 100), opacity: 0 }}
                            transition={{
                                x: { duration: 0.2, ease: 'easeOut' },
                                y: { duration: 0.6, ease: 'easeInOut' },
                                opacity: { delay: 0.85, duration: 0.6 }
                            }}
                        >
                            <i class="fa-solid fa-heart fa-xs text-red-500"></i>
                        </motion.div>
                    {/each}

                    {#each circles as circle (circle.id)}
                        <motion.div
                            class="pointer-events-none absolute z-10 flex size-4 items-center justify-center rounded-full bg-red-500/30"
                            initial={{ opacity: 1, x: 0, y: 0, scale: circle.size / 15 }}
                            animate={{ x: circle.xOffset, y: -(circle.xOffset + 100), opacity: 0 }}
                            transition={{
                                x: {
                                    duration: 0.2 + circle.delay,
                                    delay: circle.delay,
                                    ease: 'easeOut'
                                },
                                y: {
                                    duration: 0.6 + circle.delay,
                                    delay: circle.delay,
                                    ease: 'easeInOut'
                                },
                                opacity: { delay: 0.4 + circle.delay, duration: 0.6 }
                            }}
                        />
                    {/each}
                </div>
            </div>
        </div>
    </div>
    <div class="text-center text-sm text-gray-300 opacity-80">
        Press or hold to like and spawn hearts. Press again to unlike.
    </div>
    <div class="mt-1 text-center text-xs text-gray-400">
        Inspired by Fancy Like Button — React + Framer Motion
    </div>

    <div class="sr-only">
        References:
        <a href="https://www.npmjs.com/package/framer-motion">Framer Motion</a>,
        <a href="https://github.com/DRlFTER/fancyLikeButton?utm_source=chatgpt.com"
            >Fancy Like Button</a
        >
    </div>
</div>
