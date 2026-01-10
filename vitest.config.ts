import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [
        tsconfigPaths(),
        svelte({
            hot: !process.env.VITEST
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
        coverage: {
            provider: 'v8',
            include: ['src/lib/**/*.{ts,svelte}'],
            exclude: [
                '**/*.d.ts',
                'src/lib/types.ts',
                'src/**/*.spec.ts',
                'src/**/*.test.ts',
                'src/lib/**/__tests__/**',
                'src/app.html',
                'src/app.d.ts',
                'src/app.css',
                'src/routes/**',
                'docs/**',
                'dist/**',
                'coverage/**',
                'node_modules/**',
                'vite.config.ts',
                'vitest.config.ts',
                'playwright.config.ts',
                'tailwind.config.ts',
                'postcss.config.js',
                'svelte.config.js'
            ]
        },
        // Vitest 4: pool options are now top-level
        maxWorkers: 4,
        minWorkers: 1,
        testTimeout: 10000,
        hookTimeout: 10000,
        reporters: process.env.CI ? ['verbose'] : ['default']
    }
})
