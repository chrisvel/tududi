import React from 'react';
import { useTranslation } from 'react-i18next';

interface UsageBarProps {
    label: string;
    used: number;
    limit: number | null;
    format?: (n: number) => string;
}

const UsageBar: React.FC<UsageBarProps> = ({
    label,
    used,
    limit,
    format = (n) => String(n),
}) => {
    const { t } = useTranslation();
    const pct =
        limit && limit > 0
            ? Math.min(100, Math.round((used / limit) * 100))
            : 0;
    const tone =
        pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500';
    return (
        <div>
            <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span>{label}</span>
                <span>
                    {format(used)}
                    {limit === null
                        ? ` / ${t('billing.unlimited', 'unlimited')}`
                        : ` / ${format(limit)}`}
                </span>
            </div>
            {limit !== null && (
                <div className="h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                        className={`h-2 ${tone}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default UsageBar;
