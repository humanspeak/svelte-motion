<script lang="ts">
    import { useReducedMotion } from '@humanspeak/svelte-motion'

    const reduced = useReducedMotion()
    let forceReduced = $state(false)
    const effective = $derived($reduced || forceReduced)
</script>

<div class="flex min-h-[420px] flex-col items-center justify-center gap-6 p-8">
    <div
        class="box"
        class:spin={!effective}
        aria-label={effective ? 'Animation disabled' : 'Animation enabled'}
    ></div>

    <div class="flex flex-col items-center gap-2 text-sm">
        <p>
            OS preference: <strong>{$reduced ? 'reduce' : 'no-preference'}</strong>
        </p>
        <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={forceReduced} />
            Force reduced motion (in-page override)
        </label>
        <p class="text-xs opacity-70">
            Tip: Chrome DevTools → Rendering → emulate
            <code>prefers-reduced-motion: reduce</code> to test the OS path.
        </p>
    </div>
</div>

<style>
    .box {
        width: 120px;
        height: 120px;
        border-radius: 18px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .box.spin {
        animation: spin 4s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
