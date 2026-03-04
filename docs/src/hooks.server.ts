import { env } from '$env/dynamic/public'
import { paraglideMiddleware } from '$lib/paraglide/server'
import { createSecurityHeadersHandle } from '@humanspeak/docs-kit/hooks'
import { initCloudflareSentryHandle, sentryHandle } from '@sentry/sveltekit'
import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

const handleParaglide: Handle = ({ event, resolve }) =>
    paraglideMiddleware(event.request, ({ request, locale }) => {
        event.request = request

        return resolve(event, {
            transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
        })
    })

export const fullSentryHandle = sequence(
    initCloudflareSentryHandle({
        environment: env.PUBLIC_ENVIRONMENT ?? 'local',
        dsn: env.PUBLIC_SENTRY_DSN,
        sendDefaultPii: true,
        tracesSampleRate: 1.0,
        enableLogs: true
    }),
    sentryHandle()
)

export const handle: Handle = sequence(
    fullSentryHandle,
    handleParaglide,
    createSecurityHeadersHandle()
)
