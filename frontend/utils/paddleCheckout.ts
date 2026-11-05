// Paddle's overlay checkout. The server opens a transaction and hands over
// what Paddle.js needs; the script is loaded only when someone pays.

export interface PaddleCheckout {
    transaction_id: string;
    client_token: string;
    environment: 'production' | 'sandbox';
    success_url: string;
}

const SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js';

let loading: Promise<any> | null = null;
let onClosed: (() => void) | null = null;

const loadScript = (): Promise<any> => {
    const w = window as any;
    if (w.Paddle) return Promise.resolve(w.Paddle);
    if (!loading) {
        loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRIPT_URL;
            script.async = true;
            script.onload = () => resolve(w.Paddle);
            script.onerror = () => {
                loading = null;
                reject(new Error('Could not load the checkout'));
            };
            document.head.appendChild(script);
        });
    }
    return loading;
};

let initializedWith: string | null = null;

// Opens the overlay. `closed` runs when the customer closes it without
// paying; after paying, Paddle sends the browser to success_url.
export const openPaddleCheckout = async (
    checkout: PaddleCheckout,
    closed?: () => void
): Promise<void> => {
    const Paddle = await loadScript();
    onClosed = closed || null;
    if (initializedWith !== checkout.client_token) {
        if (checkout.environment === 'sandbox') {
            Paddle.Environment.set('sandbox');
        }
        Paddle.Initialize({
            token: checkout.client_token,
            eventCallback: (event: { name?: string }) => {
                if (event.name === 'checkout.closed') onClosed?.();
            },
        });
        initializedWith = checkout.client_token;
    }
    Paddle.Checkout.open({
        transactionId: checkout.transaction_id,
        settings: {
            variant: 'one-page',
            successUrl: checkout.success_url,
        },
    });
};
