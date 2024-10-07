import React, { useState } from 'react';

interface NewTaskProps {
  onTaskCreate: (taskName: string) => void;
}

const NewTask: React.FC<NewTaskProps> = ({ onTaskCreate }) => {
  const [taskName, setTaskName] = useState<string>('');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTaskName(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && taskName.trim()) {
      onTaskCreate(taskName.trim());
      setTaskName('');
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 mb-1 border-b border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800">
      <span className="text-xl text-gray-500 dark:text-gray-400 mr-4">
        <i className="bi bi-plus-circle"></i>
      </span>
      <input
        type="text"
        value={taskName}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="font-medium text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 bg-transparent  dark:focus:bg-gray-900 focus:bg-transparent focus:text-gray-900 dark:focus:text-gray-100 border-b border-gray-300 dark:border-gray-700 focus:outline-none focus:border-blue-500 w-full appearance-none focus:ring-0"
        placeholder="Add New Task"
      />
    </div>
  );
};

export default NewTask;
