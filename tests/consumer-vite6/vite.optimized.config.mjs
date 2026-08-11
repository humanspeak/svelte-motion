import { svelteMotionOptimize } from '@humanspeak/svelte-motion/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [svelteMotionOptimize(), svelte()],
    resolve: {
        dedupe: ['svelte']
    }
})
