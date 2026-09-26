import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 30000,
    outputDir: `${root}test-results/docs`,
    reporter: [
        ['list'],
        ['html', { outputFolder: `${root}playwright-report/docs`, open: 'never' }]
    ],
    use: {
        baseURL: 'http://127.0.0.1:5201',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },
    webServer: {
        cwd: root,
        command:
            'pnpm package && pnpm --dir docs build && pnpm --dir docs exec vite preview --host 127.0.0.1 --port 5201 --strictPort',
        url: 'http://127.0.0.1:5201',
        timeout: 300000,
        reuseExistingServer: false
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } }
    ]
})
