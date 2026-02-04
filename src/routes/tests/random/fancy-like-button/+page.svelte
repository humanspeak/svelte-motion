<script lang="ts">
    import { motion } from '$lib'

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

    let heartButtonRef = $state<HTMLButtonElement | null>(null)
    // const heartButtonRect = new ElementRect(() => heartButtonRef)

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
        const handlePointerDown = () => {
            // console.log('pointerdown', e, heartButtonRect.width, heartButtonRect.height)
            onPointerDown()
        }
        const handlePointerUp = () => {
            // console.log('pointerup', e, heartButtonRect.width, heartButtonRect.height)
            onPointerUp()
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            // console.log('keydown', e, heartButtonRect.width, heartButtonRect.height)
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
    <div class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl p-3 pt-20">
        <div class="relative flex" use:likeInteraction>
            <motion.button
                class={`size-6 ${buttonBg} z-30 m-1 flex items-center justify-center rounded-full select-none`}
                initial={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, duration: 0.3 }}
                aria-pressed={isLiked}
                data-testid="fancy-like-button"
                bind:ref={heartButtonRef}
            >
                <svg
                    version="1.1"
                    id="Layer_1"
                    xmlns="http://www.w3.org/2000/svg"
                    x="0px"
                    y="-10px"
                    viewBox="0 0 122.88 107.41"
                    style="enableBackground: new 0 0 122.88 107.41"
                    class="size-4 pt-0.5"
                >
                    <g>
                        <path
                            class="st0"
                            d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"
                            fill={isLiked ? '#fb2c36' : '#A5AAB1'}
                        />
                    </g>
                </svg>
            </motion.button>
            <!-- Spawn origin centered on the button -->
            <div
                class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
                {#each hearts as heart (heart.id)}
                    <motion.div
                        class="pointer-events-none absolute z-20 flex size-5 items-center justify-center text-red-500/50"
                        style="translate: -50% -50%"
                        initial={{ opacity: 1, x: 0, y: 0, scale: heart.scale }}
                        animate={{ x: heart.xOffset, y: -(heart.xOffset + 100), opacity: 0 }}
                        transition={{
                            x: { duration: 0.2, ease: 'easeOut' },
                            y: { duration: 0.6, ease: 'easeInOut' },
                            opacity: { delay: 0.85, duration: 0.6 }
                        }}
                    >
                        ❤️
                    </motion.div>
                {/each}

                {#each circles as circle (circle.id)}
                    <motion.div
                        class="pointer-events-none absolute z-10 flex size-6 items-center justify-center rounded-full bg-red-500/30"
                        style="translate: -50% -50%"
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
