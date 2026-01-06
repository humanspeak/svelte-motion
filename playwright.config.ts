import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    // Run tests sequentially to avoid dispatchEvent race conditions
    // dispatchEvent-based pointer events are unreliable under parallel execution
    workers: 1,
    // Disable fully parallel - tests run sequentially to ensure reliable pointer event handling
    fullyParallel: false,
    // Retry flaky tests once
    retries: process.env.CI ? 1 : 0,
    reporter: [['junit', { outputFile: 'junit-playwright.xml' }]],
    webServer: {
        command: 'npm run build && npm run preview',
        port: 4173,
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe'
    },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'on',
        // Force fresh context per test to prevent state leakage
        contextOptions: {
            strictSelectors: true
        }
    },
    timeout: 60000,
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
        // {
        //     name: 'firefox',
        //     use: { ...devices['Desktop Firefox'] }
        // },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] }
        // },
        // {
        //     name: 'mobile-chrome',
        //     use: { ...devices['Pixel 5'] }
        // },
        // {
        //     name: 'mobile-safari',
        //     use: { ...devices['iPhone 12'] }
        // }
    ],
    expect: {
        toHaveScreenshot: {
            maxDiffPixels: 100
        }
    }
})
