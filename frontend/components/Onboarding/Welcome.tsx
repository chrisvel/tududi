import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyStarter, StarterResult } from '../../utils/onboardingService';

// The page at /welcome every account sees once, inside the normal layout:
// the welcome video and one button. The button records the visit (as the
// "empty" starter) so the page never comes back on its own, then Today
// opens with the brain dump.

export const WELCOME_VIDEO_ID = 'hkwb9EmE4XE';

interface WelcomeProps {
    onDone: (result: StarterResult) => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onDone }) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const start = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            onDone(await applyStarter({ key: 'empty' }));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
        }
    };

    return (
        <div
            className="flex w-full min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
            data-testid="welcome-page"
        >
            <section className="flex w-full max-w-4xl flex-col items-center text-center">
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                    {t('onboarding.starter.kicker', 'Welcome to tududi')}
                </p>
                <h1
                    id="welcome-title"
                    className="text-2xl font-light text-gray-900 sm:text-3xl dark:text-gray-100"
                >
                    {t(
                        'onboarding.starter.welcomeTitle',
                        'Take a look at what you can do with tududi in a minute'
                    )}
                </h1>
                <div className="mt-6 w-full overflow-hidden rounded-2xl bg-gray-900 shadow-sm aspect-video">
                    <iframe
                        className="h-full w-full"
                        src={`https://www.youtube-nocookie.com/embed/${WELCOME_VIDEO_ID}?rel=0&modestbranding=1`}
                        title={t(
                            'onboarding.starter.videoTitle',
                            'A one minute tour of tududi'
                        )}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        data-testid="welcome-video"
                    />
                </div>
                {error && (
                    <p
                        className="mt-4 w-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                        role="alert"
                    >
                        {error}
                    </p>
                )}
                <button
                    type="button"
                    onClick={start}
                    disabled={busy}
                    data-testid="welcome-start"
                    className="mt-6 h-11 rounded-lg bg-blue-600 px-8 font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                    {busy
                        ? t('onboarding.starter.settingUp', 'Setting up...')
                        : t(
                              'onboarding.starter.letsStart',
                              "I'm done, let's start"
                          )}
                </button>
            </section>
        </div>
    );
};

export default Welcome;
