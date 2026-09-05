import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { PLAN_LIMIT_EVENT, PlanLimitDetail } from '../../utils/planLimits';

// Listens for 402 responses surfaced by the API wrappers and explains which
// plan limit was hit. Mounted once in the layout; invisible until needed.
const UpgradeModal: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [detail, setDetail] = useState<PlanLimitDetail | null>(null);

    useEffect(() => {
        const handler = (event: Event) => {
            setDetail((event as CustomEvent<PlanLimitDetail>).detail);
        };
        window.addEventListener(PLAN_LIMIT_EVENT, handler);
        return () => window.removeEventListener(PLAN_LIMIT_EVENT, handler);
    }, []);

    if (!detail) return null;

    const { code, details } = detail;
    const resourceLabel = (resource?: string) => {
        switch (resource) {
            case 'task':
                return t('billing.resource.task', 'active tasks');
            case 'project':
                return t('billing.resource.project', 'projects');
            case 'note':
                return t('billing.resource.note', 'notes');
            case 'storage':
                return t('billing.resource.storage', 'attachment storage');
            case 'ai_requests':
                return t('billing.resource.ai', 'AI requests today');
            default:
                return resource || '';
        }
    };
    const featureLabel = (feature?: string) => {
        switch (feature) {
            case 'ai':
                return t('billing.feature.ai', 'the AI assistant');
            case 'mcp':
                return t('billing.feature.mcp', 'MCP integration');
            case 'caldav':
                return t('billing.feature.caldav', 'CalDAV sync');
            case 'telegram':
                return t('billing.feature.telegram', 'the Telegram bot');
            case 'backups_import':
                return t('billing.feature.backups_import', 'backup import');
            case 'attachments':
                return t('billing.feature.attachments', 'attachments');
            default:
                return feature || '';
        }
    };

    const message =
        code === 'FEATURE_NOT_IN_PLAN'
            ? t('billing.featureNotInPlan', {
                  defaultValue:
                      'Your {{plan}} plan does not include {{feature}}.',
                  plan: details?.plan,
                  feature: featureLabel(details?.feature),
              })
            : t('billing.limitReached', {
                  defaultValue:
                      'Your {{plan}} plan allows {{limit}} {{resource}}. You are at {{current}}.',
                  plan: details?.plan,
                  limit:
                      details?.resource === 'storage'
                          ? `${Math.round((details.limit || 0) / (1024 * 1024))} MB`
                          : details?.limit,
                  resource: resourceLabel(details?.resource),
                  current:
                      details?.resource === 'storage'
                          ? `${Math.round((details.current || 0) / (1024 * 1024))} MB`
                          : details?.current,
              });

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-70"
            onClick={() => setDetail(null)}
            data-testid="upgrade-modal"
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center">
                    <SparklesIcon className="w-6 h-6 mr-3 text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('billing.upgradeTitle', 'Upgrade to keep going')}
                    </h3>
                </div>
                <div className="px-6 py-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <p>{message}</p>
                    <p>
                        {t(
                            'billing.upgradeHint',
                            'Everything you already have stays exactly as it is. Upgrading lifts the limit right away.'
                        )}
                    </p>
                </div>
                <div className="px-6 py-4 flex justify-end space-x-2">
                    <button
                        type="button"
                        onClick={() => setDetail(null)}
                        className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                        {t('common.close', 'Close')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setDetail(null);
                            navigate('/profile?section=billing');
                        }}
                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                        data-testid="upgrade-modal-cta"
                    >
                        {t('billing.seePlans', 'See plans')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;
