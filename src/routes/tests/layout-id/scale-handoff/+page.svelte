<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'

    // Port of upstream Motion #2284 (commit 597fc2c91,
    // dev/react/src/tests/issue-2284.tsx at v14.6.0): a shared `layoutId`
    // element that also animates `scale` must never render larger than its
    // final scaled size during the layout animation, nor jump at the end.
    // `?linear` uses a 2s linear transition; `?static` gives both boxes a
    // static `scale: 0.5` instead of animating it.
    // e2e/layout-id/scale-handoff.spec.ts.

    let linear = $state(false)
    let isStatic = $state(false)
    let open = $state(false)

    onMount(() => {
        const params = new URLSearchParams(location.search)
        linear = params.get('linear') !== null
        isStatic = params.get('static') !== null
    })

    const transition = $derived(
        linear || isStatic ? { duration: 2, ease: 'linear' as const } : undefined
    )
    const scale = $derived(isStatic ? 0.5 : undefined)
</script>

<div style="padding: 20px;">
    <ul style="list-style: none; margin: 0; padding: 0;">
        <li>
            <motion.div
                id="card"
                data-testid="card"
                layoutId="card"
                {transition}
                onclick={() => (open = true)}
                style={{ width: '100px', height: '150px', background: 'red', scale }}
            />
        </li>
    </ul>
</div>

<!-- Svelte has no createPortal: a fixed full-screen overlay rendered last,
     outside any transformed ancestor, stands in for upstream's portal. -->
{#if open}
    <div
        style="position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: #00000060;"
    >
        <motion.div
            id="modal"
            data-testid="modal"
            layoutId="card"
            {transition}
            animate={isStatic ? undefined : { scale: 1.5 }}
            style={{ width: '100px', height: '150px', background: 'blue', scale }}
        />
    </div>
{/if}
