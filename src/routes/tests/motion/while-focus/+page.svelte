<script lang="ts">
    import { motion } from '$lib'
</script>

<div style="display: flex; gap: 20px; padding: 20px; flex-direction: column;">
    <motion.button
        whileFocus={{ scale: 1.2, outline: '2px solid #0d63f8' }}
        style="width: 100px; height: 100px; background-color: #9911ff; border-radius: 5px; border: none; cursor: pointer;"
        data-testid="motion-while-focus-button"
    >
        Focus Me
    </motion.button>

    <motion.input
        type="text"
        placeholder="Focus this input"
        whileFocus={{ scale: 1.1, borderColor: '#0d63f8' }}
        style="width: 200px; padding: 10px; border: 2px solid #ccc; border-radius: 5px;"
        data-testid="motion-while-focus-input"
    />

    <motion.div
        tabindex="0"
        whileFocus={{ scale: 1.15, backgroundColor: '#0d63f8' }}
        style="width: 150px; height: 60px; background-color: #22c55e; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white;"
        data-testid="motion-while-focus-div"
    >
        Focusable Div
    </motion.div>
</div>
