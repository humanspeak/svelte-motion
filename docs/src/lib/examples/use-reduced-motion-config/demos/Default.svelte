<script lang="ts">
    import { MotionConfig, useReducedMotionConfig } from '@humanspeak/svelte-motion'

    // `useReducedMotionConfig()` returns the resolved policy — combining the
    // nearest <MotionConfig reducedMotion="..."> ancestor with the OS-level
    // `prefers-reduced-motion` setting. Use it when a *parent* wants to
    // override what the OS says (e.g. a kiosk app that disables motion
    // regardless of the user's preference).
    let policy = $state<'never' | 'always' | 'user'>('user')
    const reduced = useReducedMotionConfig()
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <MotionConfig reducedMotion={policy}>
        <div
            class="box"
            class:spin={!reduced.current}
            aria-label={reduced.current ? 'Animation disabled' : 'Animation enabled'}
        ></div>
    </MotionConfig>

    <div class="info">
        <p>
            Resolved policy:
            <strong>{reduced.current ? 'reduce' : 'no-preference'}</strong>
        </p>
        <fieldset>
            <legend>Set <code>&lt;MotionConfig reducedMotion=&quot;...&quot;&gt;</code></legend>
            {#each ['never', 'user', 'always'] as option (option)}
                <label>
                    <input type="radio" name="policy" value={option} bind:group={policy} />
                    {option}
                </label>
            {/each}
        </fieldset>
        <p class="hint">
            Tip: Chrome DevTools → Rendering → emulate
            <code>prefers-reduced-motion: reduce</code> to verify the
            <code>'user'</code> path honors the OS setting.
        </p>
    </div>
</div>

<style>
    .dk-demo-shell {
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
        background: linear-gradient(135deg, #db2777 0%, #f59e0b 100%);
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
        gap: 0.75rem;
        font-size: 14px;
    }

    fieldset {
        display: flex;
        gap: 12px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
    }

    fieldset legend {
        font-size: 11px;
        opacity: 0.7;
        padding: 0 6px;
    }

    fieldset label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
    }

    .hint {
        font-size: 12px;
        opacity: 0.7;
        max-width: 360px;
        text-align: center;
    }
</style>
