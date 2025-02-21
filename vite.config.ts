import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
    plugins: [sveltekit()],

    test: {
        exclude: [
            ...configDefaults.exclude,
            'node_modules/**',
            'dist/**',
            'docs/**',
            'src/routes/**',
            'coverage/**',
            'tests/**',
            'playwright.config.ts',
            'tests-results/**',
            '**/docs/**/*'
        ],
        workspace: [
            {
                extends: './vite.config.ts',
                plugins: [svelteTesting()],

                test: {
                    name: 'client',
                    environment: 'jsdom',
                    clearMocks: true,
                    include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
                    exclude: ['src/lib/server/**'],
                    setupFiles: ['./vitest-setup-client.ts']
                }
            },
            {
                extends: './vite.config.ts',

                test: {
                    name: 'server',
                    environment: 'node',
                    include: ['src/**/*.{test,spec}.{js,ts}'],
                    exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
                }
            }
        ]
    }
})
