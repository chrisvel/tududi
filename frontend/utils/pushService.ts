import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

// Web Push for installed PWAs and browsers. One code path covers Android
// (FCM), iOS 16.4+ (Apple, only once tududi is on the Home Screen) and
// desktop browsers; the service worker in public/sw.js shows the
// notifications.

export type PushState =
    'unsupported' | 'needs-install' | 'denied' | 'default' | 'subscribed';

// The account that turned push on in this browser. A device keeps its
// browser subscription across sign-outs, but it is only re-attached to the
// same account, so someone else signing in on a shared device does not
// start receiving pushes they never asked for.
const OWNER_KEY = 'tududi_push_owner';

const readOwner = (): string | null => {
    try {
        return localStorage.getItem(OWNER_KEY);
    } catch {
        return null;
    }
};

const writeOwner = (userId: string | null) => {
    try {
        if (userId) localStorage.setItem(OWNER_KEY, userId);
        else localStorage.removeItem(OWNER_KEY);
    } catch {
        // Storage can be unavailable (private mode); push still works for
        // this session.
    }
};

export const isIos = (): boolean => {
    const ua = navigator.userAgent || '';
    // iPadOS reports itself as a Mac; touch support gives it away.
    return (
        /iPad|iPhone|iPod/.test(ua) ||
        (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    );
};

export const isStandalone = (): boolean =>
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isPushSupported = (): boolean =>
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(normalized);
    const output = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
};

const sameKey = (
    current: ArrayBuffer | null | undefined,
    expected: Uint8Array
): boolean => {
    if (!current) return false;
    const bytes = new Uint8Array(current);
    if (bytes.length !== expected.length) return false;
    return bytes.every((value, index) => value === expected[index]);
};

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) return null;
    const existing = await navigator.serviceWorker.getRegistration();
    return existing ? navigator.serviceWorker.ready : null;
};

const fetchPublicKey = async (): Promise<string> => {
    const response = await fetch(getApiPath('push/config'), {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Push is not available');
    const data = await response.json();
    return data.publicKey;
};

const saveSubscription = async (subscription: PushSubscription) => {
    const response = await fetch(getApiPath('push/subscriptions'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not save push subscription');
    }
};

const removeSubscription = async (endpoint: string) => {
    await fetch(getApiPath('push/subscriptions'), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        body: JSON.stringify({ endpoint }),
    });
};

// The browser's current subscription, or a new one when there is none or it
// was made against older server keys (they were rotated or regenerated).
const ensureSubscription = async (
    registration: ServiceWorkerRegistration
): Promise<PushSubscription> => {
    const key = urlBase64ToUint8Array(await fetchPublicKey());
    const existing = await registration.pushManager.getSubscription();
    if (existing && sameKey(existing.options.applicationServerKey, key)) {
        return existing;
    }
    if (existing) await existing.unsubscribe();
    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
    });
};

export const getPushState = async (): Promise<PushState> => {
    if (isIos() && !isStandalone()) return 'needs-install';
    if (!isPushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';

    const registration = await getRegistration();
    if (!registration) return 'unsupported';
    const subscription = await registration.pushManager.getSubscription();
    return subscription && Notification.permission === 'granted'
        ? 'subscribed'
        : 'default';
};

// Must be called straight from a click: iOS only shows the permission
// prompt in response to a user gesture.
export const enablePush = async (
    userId: string | number
): Promise<PushState> => {
    if (!isPushSupported()) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'default';

    const registration = await getRegistration();
    if (!registration) return 'unsupported';

    await saveSubscription(await ensureSubscription(registration));
    writeOwner(String(userId));
    return 'subscribed';
};

export const disablePush = async (): Promise<PushState> => {
    const registration = await getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
        await removeSubscription(subscription.endpoint).catch(() => undefined);
        await subscription.unsubscribe();
    }
    writeOwner(null);
    return getPushState();
};

// Called on sign-out, while the session still exists: the server forgets
// this device for the account, the browser keeps its subscription so the
// same person signing back in gets push again without another prompt.
export const detachPushForLogout = async (): Promise<void> => {
    try {
        if (!isPushSupported()) return;
        const registration = await getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) await removeSubscription(subscription.endpoint);
    } catch {
        // Signing out must never be blocked by push cleanup.
    }
};

// Called after sign-in and on every app start. Re-sends the subscription so
// rotated endpoints (Safari never fires pushsubscriptionchange) and changed
// server keys heal themselves.
export const resyncPush = async (userId: string | number): Promise<void> => {
    try {
        if (!isPushSupported() || Notification.permission !== 'granted') return;
        if (readOwner() !== String(userId)) return;

        const registration = await getRegistration();
        if (!registration) return;

        await saveSubscription(await ensureSubscription(registration));
    } catch {
        // Best effort; the Notifications tab lets the user re-enable.
    }
};

export const countPushDevices = async (): Promise<number> => {
    const response = await fetch(getApiPath('push/subscriptions'), {
        credentials: 'include',
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return Array.isArray(data.subscriptions) ? data.subscriptions.length : 0;
};
