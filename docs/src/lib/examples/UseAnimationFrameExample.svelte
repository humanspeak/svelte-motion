<script lang="ts">
    import { useAnimationFrame } from '@humanspeak/svelte-motion'

    let cubeRef: HTMLDivElement

    $effect(() => {
        return useAnimationFrame((time) => {
            if (!cubeRef) return

            const rotateX = Math.sin(time / 10000) * 20
            const rotateY = (time / 20) % 360
            const y = Math.sin(time / 1000) * 30
            cubeRef.style.transform = `translateY(${y}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
        })
    })
</script>

<div class="flex min-h-[500px] items-center justify-center p-8">
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
</div>

<style>
    .container {
        perspective: 1000px;
        width: 250px;
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .cube {
        width: 150px;
        height: 150px;
        position: relative;
        transform-style: preserve-3d;
    }

    .side {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0.9;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backface-visibility: visible;
    }

    .front {
        transform: rotateY(0deg) translateZ(75px);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .right {
        transform: rotateY(90deg) translateZ(75px);
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .back {
        transform: rotateY(180deg) translateZ(75px);
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .left {
        transform: rotateY(-90deg) translateZ(75px);
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .top {
        transform: rotateX(90deg) translateZ(75px);
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }

    .bottom {
        transform: rotateX(-90deg) translateZ(75px);
        background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
    }
</style>
