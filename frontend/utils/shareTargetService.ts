// Web Share Target support. When the OS share sheet (Android, or desktop
// Chrome/Edge) hands content to the installed PWA it performs a plain GET
// navigation to the `action` declared in `share_target` (public/manifest.json)
// with the shared title/text/url as query params.
//
// The payload is stashed in sessionStorage rather than read straight off the
// URL because the navigation may be bounced to /login when the session has
// expired, which would otherwise drop the shared content.

const STORAGE_KEY = 'tududi_pending_share';

// A share that has been sitting around this long is stale — the user has moved
// on and we should not hijack their navigation with it.
const MAX_AGE_MS = 10 * 60 * 1000;

const SHARE_PARAMS = ['title', 'text', 'url'] as const;

interface PendingShare {
    text: string;
    ts: number;
}

// The share text, once claimed for this page load. `undefined` means it has
// not been looked up yet; `null` means there was nothing (or it has been dealt
// with). Kept in memory because the Inbox composer mounts more than once per
// page load: Layout swaps the routed page out for a full-screen loader while
// its stores run their first fetch, which unmounts and remounts the page.
// Emptying sessionStorage on that first, discarded mount would leave the
// surviving composer blank — exactly what a cold PWA launch from the share
// sheet does every time.
let claimedText: string | null | undefined;

/**
 * Builds the composer text from shared params, dropping empties and
 * duplicates: Android apps are inconsistent about which field holds what, and
 * Chrome commonly sends the same URL as both `text` and `url`.
 *
 * Returns an empty string when nothing shareable was present.
 */
export const composeSharedText = (params: URLSearchParams): string => {
    const parts: string[] = [];

    for (const key of SHARE_PARAMS) {
        const value = (params.get(key) || '').trim();
        if (value && !parts.includes(value)) {
            parts.push(value);
        }
    }

    return parts.join(' ');
};

const hasShareParams = (params: URLSearchParams): boolean =>
    SHARE_PARAMS.some((key) => params.has(key));

const readPendingShare = (): PendingShare | null => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<PendingShare>;
        if (typeof parsed?.text !== 'string' || !parsed.text) return null;
        if (
            typeof parsed.ts !== 'number' ||
            Date.now() - parsed.ts > MAX_AGE_MS
        ) {
            sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return { text: parsed.text, ts: parsed.ts };
    } catch {
        // Private-mode storage failures / malformed JSON: behave as "no share"
        return null;
    }
};

/**
 * Reads shared content out of the current URL and stashes it, then strips the
 * share params so a reload or a bookmark doesn't replay the same share.
 *
 * Called once at startup, before React renders, so the router only ever sees
 * the cleaned URL.
 */
export const captureSharedPayload = (): void => {
    const params = new URLSearchParams(window.location.search);
    if (!hasShareParams(params)) return;

    const text = composeSharedText(params);

    for (const key of SHARE_PARAMS) {
        params.delete(key);
    }
    const query = params.toString();
    window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    );

    if (!text) return;

    // A newly arrived share supersedes anything claimed earlier in this page's
    // lifetime (only reachable in tests, where the module isn't reloaded).
    claimedText = undefined;

    try {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ text, ts: Date.now() } satisfies PendingShare)
        );
    } catch {
        // Nothing to fall back to — the share is simply lost
    }
};

/**
 * True while a captured share is still waiting for a composer to claim it —
 * i.e. the share arrived before the Inbox could be rendered (session expired,
 * so the navigation landed on /login).
 */
export const hasPendingSharedText = (): boolean => readPendingShare() !== null;

/**
 * Returns the captured share text for this page load, stable across remounts.
 *
 * The persisted copy is dropped on the first call so a later reload can't
 * replay the same share; call `clearSharedText()` once the user has acted on
 * it to stop offering it for the rest of the page load.
 */
export const takeSharedText = (): string | null => {
    if (claimedText === undefined) {
        const pending = readPendingShare();
        claimedText = pending ? pending.text : null;

        if (pending) {
            try {
                sessionStorage.removeItem(STORAGE_KEY);
            } catch {
                // Ignore: worst case the same text is offered again on reload
            }
        }
    }

    return claimedText;
};

/**
 * Drops a claimed share so returning to the Inbox later in the same page load
 * doesn't prefill it again. A share that hasn't been claimed yet is left alone:
 * it's still waiting for the Inbox to render (see `hasPendingSharedText`).
 */
export const clearSharedText = (): void => {
    if (claimedText !== undefined) {
        claimedText = null;
    }
};
