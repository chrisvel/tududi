import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    EnterKeyBehavior,
    updateCaptureSettings,
    useCaptureSettings,
} from '../../../utils/captureSettings';

const selectClass =
    'mt-1.5 block w-full sm:w-64 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

// Settings for the shared "Add" box. They apply straight away and are kept on
// this device.
const CaptureSettingsCard: React.FC = () => {
    const { t } = useTranslation();
    const settings = useCaptureSettings();

    const enterOptions = (
        <>
            <option value="save">{t('capture.settings.save', 'Saves')}</option>
            <option value="newline">
                {t('capture.settings.newline', 'Starts a new line')}
            </option>
        </>
    );

    return (
        <div
            className="mb-6 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-5"
            data-testid="capture-settings"
        >
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('capture.settings.title', 'Adding items')}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                {t(
                    'capture.settings.description',
                    'How the Add box behaves. These apply immediately and are kept on this device.'
                )}
            </p>

            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="capture-enter-keyboard"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {t(
                            'capture.settings.enterKeyboard',
                            'Enter key on a computer keyboard'
                        )}
                    </label>
                    <select
                        id="capture-enter-keyboard"
                        value={settings.enterKeyboard}
                        onChange={(e) =>
                            updateCaptureSettings({
                                enterKeyboard: e.target
                                    .value as EnterKeyBehavior,
                            })
                        }
                        className={selectClass}
                    >
                        {enterOptions}
                    </select>
                </div>

                <div>
                    <label
                        htmlFor="capture-enter-touch"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {t(
                            'capture.settings.enterTouch',
                            'Return key on a phone or tablet'
                        )}
                    </label>
                    <select
                        id="capture-enter-touch"
                        value={settings.enterTouch}
                        onChange={(e) =>
                            updateCaptureSettings({
                                enterTouch: e.target.value as EnterKeyBehavior,
                            })
                        }
                        className={selectClass}
                    >
                        {enterOptions}
                    </select>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.oneItemPerLine}
                        onChange={(e) =>
                            updateCaptureSettings({
                                oneItemPerLine: e.target.checked,
                            })
                        }
                        className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t(
                                'capture.settings.oneItemPerLine',
                                'One item per line'
                            )}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t(
                                'capture.settings.oneItemPerLineHelp',
                                'Off: everything you type becomes one item, with the first line as its title and the other lines as its notes. On: each line becomes its own item.'
                            )}
                        </span>
                    </span>
                </label>
            </div>
        </div>
    );
};

export default CaptureSettingsCard;
