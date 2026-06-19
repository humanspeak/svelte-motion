import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public'
import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogClient() {
    if (!posthogClient) {
        posthogClient = new PostHog(PUBLIC_POSTHOG_PROJECT_TOKEN, {
            host: PUBLIC_POSTHOG_HOST,
            flushAt: 1,
            flushInterval: 0
        })
    }
    return posthogClient
}

export async function shutdownPostHog() {
    if (posthogClient) {
        await posthogClient.shutdown()
    }
}
