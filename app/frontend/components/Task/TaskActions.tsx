import React from 'react';

interface TaskActionsProps {
  taskId: number | undefined;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const TaskActions: React.FC<TaskActionsProps> = ({ taskId, onDelete, onSave, onCancel }) => {
  return (
    <div className="flex justify-end items-center mt-4 space-x-2">
      {taskId && (
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center px-3 py-1.5 text-white bg-red-500 rounded hover:bg-red-600"
        >
          <i className="bi bi-trash mr-2"></i> Delete
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Save
      </button>
    </div>
  );
};

export default TaskActions;
