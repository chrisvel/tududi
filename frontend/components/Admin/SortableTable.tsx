import React, { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';

export type SortDir = 'asc' | 'desc';
type SortValue = string | number | boolean | null | undefined;

// Container for every admin table: a solid surface, never the page behind.
export const ADMIN_TABLE_WRAPPER =
    'overflow-x-auto rounded-lg bg-white dark:bg-gray-800 shadow-sm';

const compare = (a: SortValue, b: SortValue): number => {
    if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b, undefined, {
            sensitivity: 'base',
            numeric: true,
        });
    }
    return Number(a) - Number(b);
};

const isEmpty = (value: SortValue) =>
    value === null || value === undefined || value === '';

// Sorts rows by a column the viewer picks. Each column is an accessor that
// returns something comparable (a date as its timestamp). Empty values go
// last whichever way the column is sorted, so the rows with data stay on top.
export function useSortedRows<T>(
    rows: T[],
    accessors: Record<string, (row: T) => SortValue>,
    initial?: { key: string; dir: SortDir }
) {
    const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(
        initial ?? null
    );

    const sorted = useMemo(() => {
        const accessor = sort ? accessors[sort.key] : undefined;
        if (!sort || !accessor) return rows;
        const sign = sort.dir === 'asc' ? 1 : -1;
        return [...rows].sort((left, right) => {
            const a = accessor(left);
            const b = accessor(right);
            if (isEmpty(a) && isEmpty(b)) return 0;
            if (isEmpty(a)) return 1;
            if (isEmpty(b)) return -1;
            return compare(a, b) * sign;
        });
        // accessors is a fresh object each render; the key picks the column
    }, [rows, sort]);

    // A first click sorts ascending, a second descending.
    const toggle = (key: string) =>
        setSort((current) =>
            current?.key === key
                ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'asc' }
        );

    return {
        sorted,
        sortKey: sort?.key ?? null,
        sortDir: sort?.dir ?? null,
        toggle,
    };
}

interface SortHeaderProps {
    label: React.ReactNode;
    column: string;
    sortKey: string | null;
    sortDir: SortDir | null;
    onSort: (column: string) => void;
    className?: string;
    align?: 'left' | 'right';
}

export const SortHeader: React.FC<SortHeaderProps> = ({
    label,
    column,
    sortKey,
    sortDir,
    onSort,
    className = 'px-4 py-2',
    align = 'left',
}) => {
    const active = sortKey === column;
    const Icon = active && sortDir === 'desc' ? ChevronDownIcon : ChevronUpIcon;
    return (
        <th
            className={className}
            aria-sort={
                active
                    ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                    : 'none'
            }
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`group inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white ${
                    align === 'right' ? 'flex-row-reverse' : ''
                }`}
                data-testid={`sort-${column}`}
            >
                <span>{label}</span>
                <Icon
                    className={`h-4 w-4 ${active ? '' : 'opacity-0 group-hover:opacity-40'}`}
                    aria-hidden="true"
                />
            </button>
        </th>
    );
};
