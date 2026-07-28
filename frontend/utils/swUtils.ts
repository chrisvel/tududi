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
