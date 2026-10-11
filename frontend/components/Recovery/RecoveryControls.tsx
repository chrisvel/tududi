// Life-to-Day (T-504): "Lighten my day" and Overwhelmed mode. No blame in
// the copy; Undo goes through the existing toast and Journal path.
import React from 'react';
import { useTranslation } from 'react-i18next';

interface RecoveryControlsProps {
    heavyDay: boolean;
    busy: boolean;
    onLighten: () => void;
    onOverwhelmed: () => void;
}

const RecoveryControls: React.FC<RecoveryControlsProps> = ({
    heavyDay,
    busy,
    onLighten,
    onOverwhelmed,
}) => {
    const { t } = useTranslation();
    return (
        <section
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            data-testid="recovery-controls"
        >
            {heavyDay ? (
                <p
                    className="text-sm text-gray-700 dark:text-gray-300"
                    data-testid="recovery-banner"
                >
                    {t(
                        'recovery.heavyDay',
                        'Heavy day? Let’s make it lighter.'
                    )}
                </p>
            ) : (
                <span />
            )}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onLighten}
                    disabled={busy}
                    className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    data-testid="recovery-lighten"
                >
                    {t('recovery.lighten', 'Lighten my day')}
                </button>
                <button
                    type="button"
                    onClick={onOverwhelmed}
                    disabled={busy}
                    className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    data-testid="overwhelmed-on"
                >
                    {t('recovery.overwhelmed', 'Too much right now')}
                </button>
            </div>
        </section>
    );
};

export default RecoveryControls;
