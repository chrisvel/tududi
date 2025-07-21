import React from 'react';
import SortFilterButton, { SortOption } from './SortFilterButton';

export interface SortFilterProps {
    sortOptions: SortOption[];
    sortValue: string;
    onSortChange: (value: string) => void;
    className?: string;
}

const SortFilter: React.FC<SortFilterProps> = ({
    sortOptions,
    sortValue,
    onSortChange,
    className = '',
}) => {
    return (
        <div className={`w-full md:w-auto ${className}`}>
            <SortFilterButton
                options={sortOptions}
                value={sortValue}
                onChange={onSortChange}
                size="desktop"
            />
        </div>
    );
};

export default SortFilter;
