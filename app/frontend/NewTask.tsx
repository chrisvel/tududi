import React, { useState } from 'react';

interface NewTaskProps {
  onTaskCreate: (taskName: string) => void;
}

const NewTask: React.FC<NewTaskProps> = ({ onTaskCreate }) => {
  const [taskName, setTaskName] = useState<string>(''); // Store the new task name

  // Handle the input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTaskName(event.target.value);
  };

  // Handle the Enter key press for task creation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && taskName.trim()) {
      onTaskCreate(taskName.trim());
      setTaskName(''); // Clear the input after task creation
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 mb-1 border-b border-gray-200 rounded-lg shadow-sm bg-white">
      <span className="text-xl text-gray-500 mr-4">
        <i className="bi bi-plus-circle"></i> {/* Add a "+" icon */}
      </span>
      <input
        type="text"
        value={taskName}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="font-medium text-sm text-gray-800 border-b focus:outline-none focus:border-blue-500 w-full"
        placeholder="Add New Task" 
      />
    </div>
  );
};

export default NewTask;
