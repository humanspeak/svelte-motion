<!--
  @component
  Demonstrates whileFocus animations for keyboard navigation and accessibility.
  Shows how elements can respond to focus events with smooth animations.
-->
<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
</script>

<div class="container">
    <p class="instructions">Tab through or click the elements below to see focus animations:</p>

    <motion.button
        class="focus-button"
        whileFocus={{ scale: 1.1, boxShadow: '0 0 0 3px rgba(13, 99, 248, 0.5)' }}
        onFocusStart={() => console.log('Button focused')}
        onFocusEnd={() => console.log('Button blurred')}
    >
        Focus Me
    </motion.button>

    <motion.input
        type="text"
        placeholder="Type here..."
        class="focus-input"
        whileFocus={{
            scale: 1.05,
            borderColor: '#0d63f8',
            boxShadow: '0 0 0 3px rgba(13, 99, 248, 0.2)'
        }}
    />

    <motion.div
        tabindex="0"
        class="focus-card"
        whileFocus={{
            scale: 1.08,
            backgroundColor: '#0d63f8',
            color: '#ffffff',
            transition: { duration: 0.2 }
        }}
    >
        Focusable Card
    </motion.div>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        align-items: center;
        padding: 40px 20px;
    }

    .instructions {
        font-size: 14px;
        color: var(--text-secondary, #6b7280);
        text-align: center;
        margin-bottom: 10px;
    }

    :global(.focus-button) {
        width: 140px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    :global(.focus-button:hover) {
        opacity: 0.9;
    }

    :global(.focus-input) {
        width: 240px;
        padding: 12px 16px;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        background: white;
        transition: background-color 0.2s;
    }

    :global(.focus-input:hover) {
        background-color: #f9fafb;
    }

    :global(.focus-card) {
        width: 180px;
        height: 80px;
        background-color: #22c55e;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: white;
        cursor: pointer;
        user-select: none;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    :global(.focus-card:hover) {
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    }
</style>
