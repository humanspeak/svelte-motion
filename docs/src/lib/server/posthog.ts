import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_PROJECT_TOKEN } from '$app/env/public'
import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

/**
 * Returns the shared analytics client when public configuration is available.
 *
 * @returns The configured client, or null when the token or host is missing.
 */
export function getPostHogClient(): PostHog | null {
    if (!PUBLIC_POSTHOG_PROJECT_TOKEN || !PUBLIC_POSTHOG_HOST) {
        return null
    }

    if (!posthogClient) {
        posthogClient = new PostHog(PUBLIC_POSTHOG_PROJECT_TOKEN, {
            host: PUBLIC_POSTHOG_HOST,
            flushAt: 1,
            flushInterval: 0
        })
    }
    return posthogClient
}

/**
 * Flushes pending analytics events and shuts down the existing client.
 *
 * @returns A promise that resolves once shutdown completes, or immediately if disabled.
 */
export async function shutdownPostHog(): Promise<void> {
    if (posthogClient) {
        await posthogClient.shutdown()
    }
}
