import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: Record<string, unknown>
            ) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}

const SCRIPT_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRIPT_SRC;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => {
                scriptPromise = null;
                reject(new Error('Could not load the captcha script'));
            };
            document.head.appendChild(script);
        });
    }
    return scriptPromise;
};

interface CaptchaWidgetProps {
    siteKey: string;
    onToken: (token: string | null) => void;
    // Bump to force a fresh challenge, for example after a failed submit
    resetKey?: number;
}

// Cloudflare Turnstile. Invisible for most visitors, a checkbox for the
// rest. Calls onToken with the token when solved and with null when it
// expires or errors, so the form can gate its submit button on it.
const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({
    siteKey,
    onToken,
    resetKey = 0,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useEffect(() => {
        let cancelled = false;
        loadScript()
            .then(() => {
                if (cancelled || !containerRef.current || !window.turnstile)
                    return;
                widgetIdRef.current = window.turnstile.render(
                    containerRef.current,
                    {
                        sitekey: siteKey,
                        theme: document.documentElement.classList.contains(
                            'dark'
                        )
                            ? 'dark'
                            : 'light',
                        callback: (token: string) => onTokenRef.current(token),
                        'expired-callback': () => onTokenRef.current(null),
                        'error-callback': () => onTokenRef.current(null),
                    }
                );
            })
            .catch((err) => console.error(err));
        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [siteKey]);

    useEffect(() => {
        if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
            onTokenRef.current(null);
            window.turnstile.reset(widgetIdRef.current);
        }
    }, [resetKey]);

    return (
        <div
            ref={containerRef}
            className="mb-4 flex justify-center"
            data-testid="captcha-widget"
        />
    );
};

export default CaptchaWidget;
