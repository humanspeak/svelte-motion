<script lang="ts">
    import { motion } from '$lib'

    let activeDirection: 'x' | 'y' | null = $state(null)

    const boxStyle =
        'position: absolute; width:64px; height:64px; background:#60a5fa; border-radius:10px; border:2px solid #94a3b8;'
    const guideColor = '#9ca3af'
</script>

<div
    data-testid="lock-container"
    style="position: relative; height: 360px; display: grid; place-items: center;"
>
    <!-- Horizontal guide -->
    <motion.div
        initial={false}
        animate={{ opacity: activeDirection === 'x' ? 1 : 0.3 }}
        transition={{ duration: 0.1 }}
        style={`position:absolute; top: 50%; left: calc(50% - 50vw); width: 100vw; height:0; border-top:2px dashed ${guideColor}; pointer-events:none; z-index:0;`}
    />

    <!-- Vertical guide -->
    <motion.div
        initial={false}
        animate={{ opacity: activeDirection === 'y' ? 1 : 0.3 }}
        transition={{ duration: 0.1 }}
        style={`position:absolute; left: 50%; top: calc(50% - 50vh); height: 100vh; width:0; border-left:2px dashed ${guideColor}; pointer-events:none; z-index:0;`}
    />

    <!-- Draggable box with direction lock -->
    <motion.div
        drag
        dragDirectionLock
        onDirectionLock={(d) => (activeDirection = d)}
        onDragEnd={() => (activeDirection = null)}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 15 }}
        dragElastic={0.2}
        whileDrag={{ cursor: 'grabbing' }}
        data-testid="lock-box"
        style={`position:relative; z-index:1; ${boxStyle}`}
    />
</div>
