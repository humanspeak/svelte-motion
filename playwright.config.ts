import { defineConfig, devices } from '@playwright/test'
import os from 'os'

export default defineConfig({
    testDir: './e2e',
    // CI uses sharding (2 shards on 4vcpu runners), so 2 workers is optimal
    // Local dev: cap at 4 workers to reduce flakiness in timing-sensitive animation tests
    workers: process.env.CI ? 2 : Math.min(4, Math.floor(os.cpus().length / 2)),
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
        screenshot: 'on'
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
