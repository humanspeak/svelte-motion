<script lang="ts">
    import { motion, AnimatePresence } from '$lib'

    const states = ['one', 'two', 'three', 'four'] as const
    let stateIndex = $state(0)
    let currentState = $derived(states[stateIndex])

    function cycle() {
        stateIndex = (stateIndex + 1) % states.length
    }

    const isPlaywright =
        typeof window !== 'undefined' && window.location.search.includes('@isPlaywright=true')

    const testTransition = isPlaywright ? { duration: 0.5 } : { duration: 0.3 }
</script>

<div
    style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;min-height:100vh;background:#0f1115;"
>
    <div style="position:relative;width:120px;height:60px;">
        <AnimatePresence>
            {#key currentState}
                <motion.div
                    key={currentState}
                    initial={{ opacity: 0, filter: 'blur(4px)', y: -10 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(4px)', y: 10 }}
                    transition={testTransition}
                    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#22d3ee;color:#0f1115;font-weight:600;"
                    data-testid="box"
                    data-state={currentState}
                >
                    {currentState}
                </motion.div>
            {/key}
        </AnimatePresence>
    </div>

    <button
        onclick={cycle}
        style="padding:8px 24px;border:none;border-radius:8px;background:#f5f5f5;color:#0f1115;cursor:pointer;font-size:14px;"
        data-testid="cycle"
    >
        Cycle ({currentState})
    </button>
</div>
