<script lang="ts">
    /**
     * Regression for `snapToOrigin` and no-momentum settle animations not
     * registering a cancel hook. If the user releases the card and then
     * immediately starts a new drag while the snap-to-origin (or
     * no-momentum elastic-clamp) animation is in flight, the prior
     * `animate(...)` controls used to keep running and fight the new
     * drag — the card would drift back toward the old animation's
     * target instead of following the pointer.
     *
     * Two cards exposed: one with `dragSnapToOrigin`, one with
     * `dragMomentum={false}` + tight elastic. Each renders its own
     * settle path and should both honour a re-grab cleanly.
     */
    import { motion } from '$lib'
</script>

<div style="display: grid; gap: 24px; padding: 24px;">
    <section>
        <p style="font: 12px system-ui; color: #888">snapToOrigin</p>
        <motion.div
            drag="x"
            dragSnapToOrigin
            transition={{ duration: 0.6 }}
            data-testid="snap-card"
            style="width:100px;height:100px;background:#0ea5e9;border-radius:8px;cursor:grab;"
        />
    </section>
    <section>
        <p style="font: 12px system-ui; color: #888">no-momentum settle</p>
        <motion.div
            drag="x"
            dragMomentum={false}
            dragConstraints={{ left: -120, right: 120 }}
            dragElastic={0.5}
            transition={{ duration: 0.6 }}
            data-testid="settle-card"
            style="width:100px;height:100px;background:#f97316;border-radius:8px;cursor:grab;"
        />
    </section>
</div>
