<script lang="ts">
    import { motion } from '$lib'
</script>

<!-- Declarative wildcard/relative settle: the animation layer resolves these
     against the live value (resolveWildcardKeyframes), but the post-animation
     resting baseline must come from the SAME resolved payload — recomputing it
     from the raw definition collapses `x: null` / `'+=50'` into an unresolved
     value that corrupts or drops the channel at settle (a visible snap).
     hold-box: x:null = keep the current (initial) 64 forever.
     relative-box: '+=50' from 64 = land and STAY at 114. -->
<main>
    <motion.div
        data-testid="hold-box"
        initial={{ x: 64 }}
        animate={{ x: null }}
        style="width: 80px; height: 80px; background: #247768;"
    />
    <motion.div
        data-testid="relative-box"
        initial={{ x: 64 }}
        animate={{ x: '+=50' }}
        transition={{ duration: 0.3, ease: 'linear' }}
        style="width: 80px; height: 80px; background: #54dbbc;"
    />
</main>

<style>
    main {
        min-height: 100vh;
        display: grid;
        place-content: center;
        gap: 24px;
        background: #101418;
    }
</style>
