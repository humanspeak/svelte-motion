<script lang="ts">
    import { useReducedMotion } from '@humanspeak/svelte-motion'

    // `useReducedMotion()` returns a reactive store backed by the
    // `(prefers-reduced-motion: reduce)` media query. Use it to gate
    // any non-essential animation — combine with an in-page override
    // so users can opt in/out independently of OS settings.
    const reduced = useReducedMotion()
    let forceReduced = $state(false)
    const effective = $derived($reduced || forceReduced)
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div
        class="box"
        class:spin={!effective}
        aria-label={effective ? 'Animation disabled' : 'Animation enabled'}
    ></div>

    <div class="info">
        <p>
            OS preference: <strong>{$reduced ? 'reduce' : 'no-preference'}</strong>
        </p>
        <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={forceReduced} />
            Force reduced motion (in-page override)
        </label>
        <p class="hint">
            Tip: Chrome DevTools → Rendering → emulate
            <code>prefers-reduced-motion: reduce</code> to test the OS path.
        </p>
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        padding: 2rem;
        min-height: 420px;
    }

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

    .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-size: 14px;
    }

    .hint {
        font-size: 12px;
        opacity: 0.7;
    }
</style>
