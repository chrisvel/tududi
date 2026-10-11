function postToSw(message: object): void {
    if (!('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker.controller;
    if (sw) {
        sw.postMessage(message);
    } else {
        navigator.serviceWorker.ready.then((reg) =>
            reg.active?.postMessage(message)
        );
    }
}

export function notifySwSession(userId: number | string): void {
    postToSw({ type: 'SESSION_UPDATE', sessionId: String(userId) });
}

export function notifySwClearCache(): void {
    postToSw({ type: 'CLEAR_CACHE' });
}

// LTD-PATCH(T-305): drive the offline write queue without Background Sync.
// iOS has no Background Sync, so the page asks the SW to replay on these
// page-side signals; each call is idempotent server-side (Idempotency-Key).
export function requestSwReplay(): void {
    postToSw({ type: 'REPLAY_QUEUE' });
}

let replayListenersInstalled = false;

export function installSwReplayTriggers(): void {
    if (replayListenersInstalled || typeof window === 'undefined') return;
    replayListenersInstalled = true;

    window.addEventListener('online', requestSwReplay);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') requestSwReplay();
    });
    // App start: replay anything left over from a previous session.
    requestSwReplay();
}

// LTD-PATCH(T-305): ask the OS to keep our storage (queue included) after
// the PWA is installed. Failure is swallowed and logged by design.
export async function requestPersistentStorage(): Promise<void> {
    try {
        if (navigator.storage?.persist) {
            const granted = await navigator.storage.persist();
            if (!granted) {
                console.info(
                    '[ltd] storage.persist() was not granted; offline data stays evictable'
                );
            }
        }
    } catch (error) {
        console.warn('[ltd] storage.persist() failed:', error);
    }
}
