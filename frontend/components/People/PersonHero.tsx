import React from 'react';
import { UserIcon } from '@heroicons/react/24/outline';

interface PersonHeroProps {
    name: string;
    tint: string;
    meta: React.ReactNode;
    description: React.ReactNode;
    actions: React.ReactNode;
    doneCount: number;
    totalCount: number;
}

// Same card as the goal, area, tag and project headers: tinted surface,
// icon tile, title, outlined actions, and a progress bar for assigned tasks.
const PersonHero: React.FC<PersonHeroProps> = ({
    name,
    tint,
    meta,
    description,
    actions,
    doneCount,
    totalCount,
}) => {
    const percent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
        <div className="mb-6 space-y-3">
            <div
                className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 dark:bg-gray-900"
                style={{
                    backgroundImage: `linear-gradient(color-mix(in srgb, ${tint} 10%, transparent), color-mix(in srgb, ${tint} 10%, transparent))`,
                }}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <span
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-4 ring-white dark:bg-gray-800 dark:ring-gray-900"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tint} 18%, transparent)`,
                            color: tint,
                        }}
                    >
                        <UserIcon className="h-7 w-7" />
                    </span>

                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            {meta}
                        </div>
                        <h1
                            className="line-clamp-2 text-xl font-semibold leading-tight text-gray-900 sm:text-2xl dark:text-gray-100"
                            data-testid="person-name"
                        >
                            {name}
                        </h1>
                        {description}
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        {actions}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                        <span>
                            Assigned tasks · {doneCount} of {totalCount} done
                        </span>
                        <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {percent}
                            <span className="ml-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                %
                            </span>
                        </span>
                    </div>
                    <div
                        className="relative h-1.5 rounded-full"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${tint} 20%, transparent)`,
                        }}
                    >
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonHero;
