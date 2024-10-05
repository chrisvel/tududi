import React, { useState } from 'react';

const NewProjectModal: React.FC = () => {
  const [projectName, setProjectName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission logic here, such as calling an API to save the new project
    console.log('New project created:', projectName);
    // Clear the form after submission
    setProjectName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-gray-900 bg-opacity-50 flex justify-center items-center"
      id="newProjectModal"
    >
      <div className="bg-white rounded-lg overflow-hidden shadow-xl w-full max-w-md">
        <div className="px-4 py-3 border-b border-gray-300">
          <h5 className="text-lg font-bold">New Project</h5>
          <button
            type="button"
            className="text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => (document.getElementById('newProjectModal')!.style.display = 'none')}
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <input
              type="text"
              id="projectName"
              name="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-1 p-2 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300"
              onClick={() => (document.getElementById('newProjectModal')!.style.display = 'none')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
