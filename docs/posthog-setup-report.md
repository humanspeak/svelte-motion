# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Svelte Motion docs site. The core foundation (client init, server singleton, reverse proxy, error tracking, and the major conversion events) was already in place. This run extended coverage to two additional discovery pages and rebuilt the analytics dashboard with fresh insights.

- **Client initialization** (`src/hooks.client.ts`): PostHog is initialized via the SvelteKit `init` hook with a `/ingest` proxy host and exception capture enabled. `handleError` forwards all unhandled client-side errors to PostHog.
- **Server-side singleton** (`src/lib/server/posthog.ts`): A `getPostHogClient()` singleton provides a `posthog-node` instance for server routes, configured with `flushAt: 1` / `flushInterval: 0` for immediate flushing.
- **Reverse proxy + server error capture** (`src/hooks.server.ts`): A `handlePostHogProxy` handle routes `/ingest/*` (and `/ingest/static/*`, `/ingest/array/*`) to the PostHog ingestion servers, bypassing ad-blockers. `handleError` captures server-side errors with status and message.
- **Session replay config** (`svelte.config.js`): `paths: { relative: false }` is set, required for PostHog session replay to work correctly under SSR.
- **Environment variables** written to `.env.local`: `PUBLIC_POSTHOG_PROJECT_TOKEN`, `PUBLIC_POSTHOG_HOST`.
- **New events added this run**: `examples_index_viewed` (examples index page) and `svelte_animations_viewed` (pattern gallery page).

| Event                           | Description                                                                     | File                                                |
| ------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| `get_started_clicked`           | User clicks the primary "get started" CTA on the hero section                   | `src/routes/+page.svelte`                           |
| `install_command_copied`        | User copies the npm install command from the homepage hero or footer            | `src/routes/+page.svelte`                           |
| `example_tile_clicked`          | User clicks a featured example tile on the homepage grid                        | `src/routes/+page.svelte`                           |
| `compare_library_clicked`       | User clicks a competitor library link in the comparison table                   | `src/routes/+page.svelte`                           |
| `llms_txt_opened`               | User clicks an AI-ready docs link (llms.txt, llms-full.txt, or per-page mirror) | `src/routes/+page.svelte`                           |
| `compare_index_viewed`          | User views the compare index — signals competitive research intent              | `src/routes/compare/+page.svelte`                   |
| `compare_page_viewed`           | User views a library comparison page                                            | `src/routes/compare/[slug]/+page.svelte`            |
| `doc_page_viewed`               | User navigates to a documentation page — top of the adoption funnel             | `src/routes/docs/+layout.svelte`                    |
| `examples_index_viewed`         | User views the full examples index page                                         | `src/routes/examples/+page.svelte`                  |
| `svelte_animations_viewed`      | User views the Svelte Animations pattern gallery page                           | `src/routes/svelte-animations/+page.svelte`         |
| `component_source_opened`       | User opens the Component Source dialog to view a component's code               | `src/lib/components/general/ComponentSource.svelte` |
| `component_source_copied`       | User copies source code from the Component Source dialog                        | `src/lib/components/general/ComponentSource.svelte` |
| `registry_component_downloaded` | Server: tooling fetches a component JSON from the registry endpoint             | `src/routes/r/[slug].json/+server.ts`               |
| `server_error`                  | Server: unhandled server-side error captured with status and message            | `src/hooks.server.ts`                               |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/477595/dashboard/1735755)
- [Install command copies (last 30 days)](https://us.posthog.com/project/477595/insights/2DqWjUy3) — bold-number of total copy actions, the primary install conversion signal
- [Registry component downloads over time](https://us.posthog.com/project/477595/insights/yEPGeIUX) — server-side line chart of CLI/API component fetches
- [Docs page views by unique visitors](https://us.posthog.com/project/477595/insights/lZnGrTP3) — daily unique visitors reading documentation
- [Get started → Docs conversion](https://us.posthog.com/project/477595/insights/ivG8gJEn) — CTA clicks vs docs visits, side-by-side
- [Example & source exploration](https://us.posthog.com/project/477595/insights/GFsf6vka) — example tile clicks, source opens, and source copies on one chart

## Verify before merging

- [ ] Run a full production build (`pnpm run build` from the docs workspace) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or Wrangler's upload step) into CI so production stack traces de-minify in PostHog error tracking.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-sveltekit/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
