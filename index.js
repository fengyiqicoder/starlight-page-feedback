/**
 * starlight-page-feedback: "Was this page helpful?" at the end of every Starlight page.
 *
 *   import starlightPageFeedback from "starlight-page-feedback";
 *   starlight({ plugins: [starlightPageFeedback()] })
 *
 * Votes go to the analytics you already run (Plausible, Umami, Google Analytics, PostHog, Fathom,
 * Simple Analytics), to your own endpoint, and readers can turn a "No" into a prefilled GitHub issue.
 */
import { makeAccessory } from './plugin.js';

// owner/repo from Starlight's editLink.baseUrl, e.g. https://github.com/owner/repo/edit/main/docs/
function repoFrom(starlightConfig) {
	const m = String(starlightConfig?.editLink?.baseUrl || '').match(/github\.com\/([^/]+\/[^/]+)/);
	return m ? m[1] : '';
}

export default function starlightPageFeedback(options = {}) {
	return makeAccessory(
		'starlight-page-feedback',
		{
			github: options.github ?? null,
			endpoint: options.endpoint ?? '',
			analytics: options.analytics ?? true,
			event: options.event ?? 'Docs Feedback',
			labels: options.labels ?? {},
			exclude: options.exclude ?? [],
			ai: options.ai ?? false,
		},
		(sl) => (options.github === undefined ? { github: repoFrom(sl) } : {})
	);
}
