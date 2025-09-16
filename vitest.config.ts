import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [
        tsconfigPaths(),
        svelte({
            hot: !process.env.VITEST,
            compilerOptions: {
                accessors: false
            }
        }),
        svelteTesting()
    ],
    resolve: {
        ...(process.env.VITEST
            ? {
                  conditions: ['browser']
              }
            : {})
    },
    define: {
        // Eliminate in-source test code
        'import.meta.vitest': 'undefined'
    },
    optimizeDeps: {
        exclude: [
            'codemirror',
            '@codemirror/lang-javascript',
            '@codemirror/lang-sql',
            '@codemirror/lang-markdown' /* ... */
        ]
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['vitest.setup.ts'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: [...configDefaults.exclude, 'tests'],
        poolOptions: {
            threads: {
                singleThread: false,
                maxThreads: 4,
                minThreads: 1
            }
        },
        testTimeout: 10000,
        hookTimeout: 10000,
        reporters: process.env.CI ? ['verbose'] : ['default']
    }
})
