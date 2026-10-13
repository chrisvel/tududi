import { getPushState, resyncPush } from '../pushService';

jest.mock('../csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('token'),
}));

const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const setUserAgent = (ua: string) =>
    Object.defineProperty(window.navigator, 'userAgent', {
        value: ua,
        configurable: true,
    });

const setStandalone = (standalone: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: standalone });
};

const installPush = ({
    permission,
    subscription,
}: {
    permission: NotificationPermission;
    subscription: object | null;
}) => {
    const pushManager = {
        getSubscription: jest.fn().mockResolvedValue(subscription),
        subscribe: jest.fn(),
    };
    const registration = { pushManager };
    Object.defineProperty(window.navigator, 'serviceWorker', {
        value: {
            getRegistration: jest.fn().mockResolvedValue(registration),
            ready: Promise.resolve(registration),
        },
        configurable: true,
    });
    (window as unknown as { PushManager: unknown }).PushManager =
        function () {};
    (window as unknown as { Notification: unknown }).Notification = {
        permission,
    };
    return pushManager;
};

describe('pushService', () => {
    beforeEach(() => {
        localStorage.clear();
        global.fetch = jest.fn();
        setStandalone(false);
    });

    describe('getPushState', () => {
        it('asks iPhone users in a Safari tab to add tududi to the Home Screen', async () => {
            setUserAgent(IPHONE_UA);
            installPush({ permission: 'default', subscription: null });

            expect(await getPushState()).toBe('needs-install');
        });

        it('offers push on an iPhone once tududi runs from the Home Screen', async () => {
            setUserAgent(IPHONE_UA);
            setStandalone(true);
            installPush({ permission: 'default', subscription: null });

            expect(await getPushState()).toBe('default');
        });

        it('offers push in an Android browser tab', async () => {
            setUserAgent(ANDROID_UA);
            installPush({ permission: 'default', subscription: null });

            expect(await getPushState()).toBe('default');
        });

        it('reports blocked notifications', async () => {
            setUserAgent(ANDROID_UA);
            installPush({ permission: 'denied', subscription: null });

            expect(await getPushState()).toBe('denied');
        });

        it('reports a subscribed device', async () => {
            setUserAgent(ANDROID_UA);
            installPush({
                permission: 'granted',
                subscription: { endpoint: 'https://push.example/1' },
            });

            expect(await getPushState()).toBe('subscribed');
        });
    });

    describe('resyncPush', () => {
        it('does not attach the device to an account that never turned push on', async () => {
            setUserAgent(ANDROID_UA);
            localStorage.setItem('tududi_push_owner', 'someone-else');
            const pushManager = installPush({
                permission: 'granted',
                subscription: { endpoint: 'https://push.example/1' },
            });

            await resyncPush('me');

            expect(global.fetch).not.toHaveBeenCalled();
            expect(pushManager.getSubscription).not.toHaveBeenCalled();
        });
    });
});
