import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, MinusIcon, ClockIcon, CheckCircleIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline'; 
import { StatusType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';

interface StatusDropdownProps {
  value: StatusType;
  onChange: (value: StatusType) => void;
}

const StatusDropdown: React.FC<StatusDropdownProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  
  const statuses = [
    { value: 'not_started', label: t('status.notStarted', 'Not Started'), icon: <MinusIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> },
    { value: 'in_progress', label: t('status.inProgress', 'In Progress'), icon: <ClockIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> },
    { value: 'done', label: t('status.done', 'Done'), icon: <CheckCircleIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> },
    { value: 'archived', label: t('status.archived', 'Archived'), icon: <ArchiveBoxIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  const handleSelect = (status: StatusType) => {
    onChange(status);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedStatus = statuses.find(s => s.value === value);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left w-full">
      <button
        type="button"
        className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none"
        onClick={handleToggle}
      >
        <span className="flex items-center space-x-2">
          {selectedStatus ? selectedStatus.icon : ''} 
          <span>{selectedStatus ? selectedStatus.label : 'Select Status'}</span>
        </span>
        <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => handleSelect(status.value as StatusType)}
              className="flex items-center justify-between space-x-2 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full"
            >
              <span className="flex items-center space-x-2">
                {status.icon} <span>{status.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusDropdown;
