import React from 'react';
import { Link } from 'react-router-dom';

export interface EntityCardProgress {
    label?: string;
    done: number;
    total: number;
    title?: string;
}

export interface EntityCardPill {
    label: string;
    color?: string | null;
}

interface EntityCardProps {
    to: string;
    title: string;
    description?: string | null;
    actions?: React.ReactNode;
    progress?: EntityCardProgress;
    details?: React.ReactNode;
    people?: React.ReactNode;
    pill?: EntityCardPill | null;
    testId?: string;
}

// A soft tint of the item's own color, readable on both themes.
const pillStyle = (color?: string | null): React.CSSProperties | undefined =>
    color
        ? {
              backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
              color: `color-mix(in srgb, ${color} 80%, currentColor)`,
          }
        : undefined;

const EntityCard: React.FC<EntityCardProps> = ({
    to,
    title,
    description,
    actions,
    progress,
    details,
    people,
    pill,
    testId,
}) => {
    const percent =
        progress && progress.total > 0
            ? Math.round((progress.done / progress.total) * 100)
            : 0;

    return (
        <div
            className="group relative flex h-full flex-col gap-2.5 rounded-lg bg-gray-50 p-5 shadow-sm transition-shadow duration-150 hover:shadow-md dark:bg-gray-900"
            data-testid={testId}
        >
            <div className="flex min-w-0 items-start gap-2">
                <Link
                    to={to}
                    title={title}
                    className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold leading-snug text-gray-900 hover:underline dark:text-gray-100"
                >
                    {title}
                </Link>
                {actions && (
                    <div className="-mr-2 -mt-0.5 flex flex-shrink-0 items-center">
                        {actions}
                    </div>
                )}
            </div>

            {description && (
                <p className="line-clamp-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                    {description}
                </p>
            )}

            {/* Pinned to the bottom so progress lines up across a row. */}
            {(people || pill || progress || details) && (
                <div className="mt-auto space-y-2 pt-2">
                    {(people || pill) && (
                        <div className="flex h-7 items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center">
                                {people}
                            </div>
                            {pill && (
                                <span
                                    className={`min-w-0 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                        pill.color
                                            ? ''
                                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                    style={pillStyle(pill.color)}
                                    title={pill.label}
                                >
                                    {pill.label}
                                </span>
                            )}
                        </div>
                    )}
                    {progress && (
                        <div className="space-y-2" title={progress.title}>
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500 tabular-nums dark:text-gray-400">
                                <span>
                                    {progress.label && `${progress.label} · `}
                                    {progress.done}/{progress.total}
                                </span>
                                <span>{percent}%</span>
                            </div>
                            <div className="h-[3px] w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                <div
                                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                        </div>
                    )}
                    {details && (
                        <div className="flex h-6 min-w-0 items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {details}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EntityCard;
