import { docsConfig } from '#lib/docs-config.js'
import manifest from '#lib/sitemap-manifest.json'
import { PUBLIC_SITE_URL } from '$app/env/public'
import { createSitemapResponse } from '@humanspeak/docs-kit/server'
import type { RequestHandler } from '@sveltejs/kit'

export const GET: RequestHandler = () =>
    createSitemapResponse({ manifest, siteUrl: PUBLIC_SITE_URL || docsConfig.url })
