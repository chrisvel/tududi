import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ArrowDownIcon, ArrowUpIcon, FireIcon } from '@heroicons/react/24/outline'; // Import the icons
import { PriorityType } from '../../entities/Task';

interface PriorityDropdownProps {
  value: PriorityType;
  onChange: (value: PriorityType) => void;
}

const priorities = [
  { value: 'low', label: 'Low', icon: <ArrowDownIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> },
  { value: 'medium', label: 'Medium', icon: <ArrowUpIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> },
  { value: 'high', label: 'High', icon: <FireIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" /> }
];

const PriorityDropdown: React.FC<PriorityDropdownProps> = ({ value, onChange }) => {
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

  const handleSelect = (priority: PriorityType) => {
    onChange(priority);
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

  const selectedPriority = priorities.find(p => p.value === value);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left w-full">
      <button
        type="button"
        className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none"
        onClick={handleToggle}
      >
        <span className="flex items-center space-x-2">
          {selectedPriority ? selectedPriority.icon : ''} 
          <span>{selectedPriority ? selectedPriority.label : 'Select Priority'}</span>
        </span>
        <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md">
          {priorities.map((priority) => (
            <button
              key={priority.value}
              onClick={() => handleSelect(priority.value as PriorityType)}
              className="flex items-center justify-between px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full"
            >
              <span className="flex items-center space-x-2">
                {priority.icon} <span>{priority.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriorityDropdown;
