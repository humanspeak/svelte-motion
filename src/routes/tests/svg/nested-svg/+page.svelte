<!--
@component
Root-`<svg>` parity pins (upstream framer-motion behavior, operator-ruled
2026-07-25 — see issue #456 for the post-1.x enhancement):

- A bound `x` on `<motion.svg>` animates as a CSS TRANSFORM (`translateX`),
  not the `x` geometry attribute — `buildSVGAttrs` treats the root `<svg>`
  tag as HTML-like.
- A bound `attrX` on `<motion.svg>` is a DOCUMENTED NO-OP: the renderer
  early-returns for root `<svg>` tags before the attrX → attribute copy, so
  the attribute stays at its server-rendered seed. React framer-motion
  behaves identically.
-->
<script lang="ts">
    import { motion, motionValue } from '$lib'

    const nestedX = motionValue(0)
    const frozenAttrX = motionValue(20)

    const bumpX = () => nestedX.set(nestedX.get() + 40)
    const bumpAttrX = () => frozenAttrX.set(frozenAttrX.get() + 40)
</script>

<main style="padding: 24px; font-family: monospace;">
    <h1>Nested &lt;motion.svg&gt; — root-tag parity pins</h1>

    <svg viewBox="0 0 400 120" width="400" height="120" style="border: 1px solid #ccc;">
        <!-- x MotionValue: animates via transform (upstream semantics) -->
        <motion.svg
            data-testid="transform-svg"
            style={{ x: nestedX }}
            y="10"
            width="80"
            height="40"
            viewBox="0 0 80 40"
        >
            <rect width="80" height="40" fill="#0d63f8" rx="6" />
        </motion.svg>

        <!-- attrX MotionValue: documented no-op on the root svg tag (#456) -->
        <motion.svg
            data-testid="frozen-svg"
            attrX={frozenAttrX}
            x="20"
            y="70"
            width="80"
            height="40"
            viewBox="0 0 80 40"
        >
            <rect width="80" height="40" fill="#ff0088" rx="6" />
        </motion.svg>
    </svg>

    <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button data-testid="bump-x" onclick={bumpX}>bump x (transform)</button>
        <button data-testid="bump-attr-x" onclick={bumpAttrX}>bump attrX (no-op on root svg)</button
        >
    </div>
</main>
