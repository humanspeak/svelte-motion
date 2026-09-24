import { beforeEach, describe, expect, it, vi } from 'vitest'

const { env, posthogConstructor, shutdown } = vi.hoisted(() => {
    const shutdown = vi.fn().mockResolvedValue(undefined)
    const posthogConstructor = vi.fn(function () {
        return { shutdown }
    })
    return {
        env: {} as Record<string, string | undefined>,
        posthogConstructor,
        shutdown
    }
})

vi.mock('$env/dynamic/public', () => ({ env }))
vi.mock('posthog-node', () => ({ PostHog: posthogConstructor }))

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    for (const key of Object.keys(env)) delete env[key]
})

describe('server PostHog client', () => {
    it.each([
        [undefined, undefined],
        [undefined, 'https://analytics.example.test'],
        ['', 'https://analytics.example.test'],
        ['test-token', undefined],
        ['test-token', '']
    ])('disables telemetry for token %s and host %s', async (token, host) => {
        env.PUBLIC_POSTHOG_PROJECT_TOKEN = token
        env.PUBLIC_POSTHOG_HOST = host
        const { getPostHogClient, shutdownPostHog } = await import('./posthog')

        expect(getPostHogClient()).toBeNull()
        await shutdownPostHog()
        expect(posthogConstructor).not.toHaveBeenCalled()
        expect(shutdown).not.toHaveBeenCalled()
    })

    it('reuses the configured client and shuts it down', async () => {
        env.PUBLIC_POSTHOG_PROJECT_TOKEN = 'test-token'
        env.PUBLIC_POSTHOG_HOST = 'https://analytics.example.test'
        const { getPostHogClient, shutdownPostHog } = await import('./posthog')

        const client = getPostHogClient()
        expect(client).not.toBeNull()
        expect(getPostHogClient()).toBe(client)
        expect(posthogConstructor).toHaveBeenCalledExactlyOnceWith('test-token', {
            host: 'https://analytics.example.test',
            flushAt: 1,
            flushInterval: 0
        })
        await shutdownPostHog()
        expect(shutdown).toHaveBeenCalledOnce()
    })
})
