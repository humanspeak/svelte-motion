<script lang="ts">
    import { useAnimationFrame } from '$lib'

    let cubeRef: HTMLDivElement

    $effect(() => {
        return useAnimationFrame((t) => {
            if (!cubeRef) return

            const rotate = Math.sin(t / 10000) * 200
            const y = (1 + Math.sin(t / 1000)) * -50
            cubeRef.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`
        })
    })
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-8">
    <div class="space-y-2 text-center">
        <h1 class="text-3xl font-bold">useAnimationFrame</h1>
        <p class="text-gray-600">
            Demonstrates the <code class="rounded bg-gray-100 px-2 py-1">useAnimationFrame</code> utility
            which runs a callback on every animation frame.
        </p>
    </div>

    <div class="container">
        <div class="cube" bind:this={cubeRef}>
            <div class="side front"></div>
            <div class="side left"></div>
            <div class="side right"></div>
            <div class="side top"></div>
            <div class="side bottom"></div>
            <div class="side back"></div>
        </div>
    </div>

    <div class="max-w-2xl space-y-4 text-sm text-gray-600">
        <p>
            The cube above is animated using <code class="rounded bg-gray-100 px-1"
                >useAnimationFrame</code
            >, which provides direct access to the animation loop. The callback receives a
            high-resolution timestamp that can be used to create time-based animations.
        </p>
        <p>
            Unlike <code class="rounded bg-gray-100 px-1">useTime</code> which returns a store,
            <code class="rounded bg-gray-100 px-1">useAnimationFrame</code> gives you direct control over
            when and how to update your elements on each frame.
        </p>
    </div>
</div>

<style>
    .container {
        perspective: 800px;
        width: 200px;
        height: 200px;
    }

    .cube {
        width: 200px;
        height: 200px;
        position: relative;
        transform-style: preserve-3d;
    }

    .side {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0.6;
    }

    .front {
        transform: rotateY(0deg) translateZ(100px);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .right {
        transform: rotateY(90deg) translateZ(100px);
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .back {
        transform: rotateY(180deg) translateZ(100px);
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .left {
        transform: rotateY(-90deg) translateZ(100px);
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .top {
        transform: rotateX(90deg) translateZ(100px);
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }

    .bottom {
        transform: rotateX(-90deg) translateZ(100px);
        background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
    }
</style>
