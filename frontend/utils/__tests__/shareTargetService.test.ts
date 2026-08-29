const setLocation = (url: string) => {
    window.history.replaceState({}, '', url);
};

// The service keeps the claimed share in module scope for the lifetime of a
// page load, so each test gets a freshly loaded module — the equivalent of the
// PWA being launched again from the share sheet.
let share: typeof import('../shareTargetService');

beforeEach(async () => {
    sessionStorage.clear();
    setLocation('/inbox');
    jest.resetModules();
    share = await import('../shareTargetService');
});

describe('composeSharedText', () => {
    it('joins title, text and url', () => {
        const params = new URLSearchParams({
            title: 'Great article',
            text: 'Worth reading',
            url: 'https://example.com/a',
        });

        expect(share.composeSharedText(params)).toBe(
            'Great article Worth reading https://example.com/a'
        );
    });

    // Chrome on Android shares a link with the same URL in both `text` and
    // `url`; naive concatenation would duplicate it
    it('drops duplicate and empty values', () => {
        const params = new URLSearchParams({
            title: '',
            text: 'https://example.com/a',
            url: 'https://example.com/a',
        });

        expect(share.composeSharedText(params)).toBe('https://example.com/a');
    });

    it('returns an empty string when nothing was shared', () => {
        expect(
            share.composeSharedText(new URLSearchParams({ text: '  ' }))
        ).toBe('');
    });
});

describe('captureSharedPayload', () => {
    it('stashes the shared text and strips the share params from the URL', () => {
        setLocation('/inbox?title=Hello&url=https%3A%2F%2Fexample.com');

        share.captureSharedPayload();

        expect(window.location.pathname).toBe('/inbox');
        expect(window.location.search).toBe('');
        expect(share.hasPendingSharedText()).toBe(true);
        expect(share.takeSharedText()).toBe('Hello https://example.com');
    });

    it('keeps unrelated query params', () => {
        setLocation('/inbox?loaded=40&text=Buy%20milk');

        share.captureSharedPayload();

        expect(window.location.search).toBe('?loaded=40');
        expect(share.takeSharedText()).toBe('Buy milk');
    });

    it('does nothing when the URL carries no share params', () => {
        setLocation('/inbox?loaded=40');

        share.captureSharedPayload();

        expect(window.location.search).toBe('?loaded=40');
        expect(share.hasPendingSharedText()).toBe(false);
    });
});

describe('takeSharedText', () => {
    // Regression: Layout swaps the routed page out for a full-screen spinner
    // while its stores make their first fetch, so the Inbox mounts, unmounts
    // and mounts again. A read that only worked once left the surviving
    // composer empty on every cold PWA launch.
    it('returns the same text on a remount within the page load', () => {
        setLocation('/inbox?text=Buy%20milk');
        share.captureSharedPayload();

        expect(share.takeSharedText()).toBe('Buy milk');
        expect(share.takeSharedText()).toBe('Buy milk');
    });

    // ...but a reload is a new page load, and must not replay the share
    it('drops the persisted copy as soon as it is claimed', () => {
        setLocation('/inbox?text=Buy%20milk');
        share.captureSharedPayload();

        share.takeSharedText();

        expect(sessionStorage.getItem('tududi_pending_share')).toBeNull();
        expect(share.hasPendingSharedText()).toBe(false);
    });

    it('ignores a share older than the max age', () => {
        setLocation('/inbox?text=Buy%20milk');
        share.captureSharedPayload();

        const elevenMinutesLater = Date.now() + 11 * 60 * 1000;
        const nowSpy = jest
            .spyOn(Date, 'now')
            .mockReturnValue(elevenMinutesLater);

        expect(share.hasPendingSharedText()).toBe(false);
        expect(share.takeSharedText()).toBeNull();

        nowSpy.mockRestore();
    });

    it('ignores malformed stored payloads', () => {
        sessionStorage.setItem('tududi_pending_share', 'not json');

        expect(share.hasPendingSharedText()).toBe(false);
        expect(share.takeSharedText()).toBeNull();
    });
});

describe('clearSharedText', () => {
    it('stops offering a claimed share', () => {
        setLocation('/inbox?text=Buy%20milk');
        share.captureSharedPayload();
        share.takeSharedText();

        share.clearSharedText();

        expect(share.takeSharedText()).toBeNull();
    });

    // The bounce through /login clears on every non-Inbox route, and must not
    // eat a share that no composer has had the chance to claim yet
    it('leaves an unclaimed share alone', () => {
        setLocation('/inbox?text=Buy%20milk');
        share.captureSharedPayload();

        share.clearSharedText();

        expect(share.hasPendingSharedText()).toBe(true);
        expect(share.takeSharedText()).toBe('Buy milk');
    });
});
