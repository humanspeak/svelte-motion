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

    let isLiked = false
    let spawnInterval: ReturnType<typeof setInterval> | null = null
    let hearts: Heart[] = []
    let circles: Circle[] = []

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

    $: buttonBg = isLiked ? 'bg-red-500' : 'bg-[#2C3A47]'

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
                    class={`h-20 w-20 ${buttonBg} z-30 flex items-center justify-center rounded-full select-none`}
                    initial={{ scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 400, duration: 0.3 }}
                    aria-pressed={isLiked}
                    role="button"
                    tabindex="0"
                >
                    <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        x="0"
                        y="-10"
                        width="40.44"
                        height="53.71"
                        viewBox="0 0 122.88 107.41"
                        class="pt-1"
                    >
                        <g>
                            <path
                                d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"
                                fill={isLiked ? '#ef4444' : '#A5AAB1'}
                            />
                        </g>
                    </svg>
                </motion.button>

                {#each hearts as heart (heart.id)}
                    <motion.div
                        ontap={() => {
                            console.log('heart')
                        }}
                        class="pointer-events-none absolute z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[#2C3A47]"
                        initial={{ opacity: 1, x: 0, y: 0, scale: heart.scale }}
                        animate={{ x: heart.xOffset, y: -(heart.xOffset + 100), opacity: 0 }}
                        transition={{
                            x: { duration: 0.2, ease: 'easeOut' },
                            y: { duration: 0.6, ease: 'easeInOut' },
                            opacity: { delay: 0.85, duration: 0.6 }
                        }}
                    >
                        <svg
                            version="1.1"
                            xmlns="http://www.w3.org/2000/svg"
                            x="0"
                            y="-10"
                            width="20.44"
                            height="53.71"
                            viewBox="0 0 122.88 107.41"
                            class="pt-1"
                        >
                            <g>
                                <path
                                    d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"
                                    fill="#A5AAB1"
                                />
                            </g>
                        </svg>
                    </motion.div>
                {/each}

                {#each circles as circle (circle.id)}
                    <motion.div
                        class="pointer-events-none absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#2C3A47]"
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
